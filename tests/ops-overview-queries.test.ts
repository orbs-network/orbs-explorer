import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
import type { ListOrder } from "../packages/domain/src/twap/types";
import { tokenQueryKey } from "../packages/domain/src/token-metadata";
import {
  spotOverviewOrdersQueryOptions,
  spotOverviewTokensQueryOptions,
} from "../apps/ops/src/lib/spot-overview-queries";

const address = (letter: string) => `0x${letter.repeat(40)}`;
const row = (inputToken: string, outputToken: string, chainId = 1) =>
  ({
    hash: `0x${"1".repeat(64)}`,
    inputToken,
    outputToken,
    order: { witness: { chainId } },
    timestamp: "2026-10-20T12:00:00Z",
  }) as ListOrder;
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });

test("routes share a fresh history snapshot without waiting for token metadata", async (t) => {
  const cache = client();
  const requests: string[] = [];
  t.mock.method(axios, "get", async (url: string) => {
    requests.push(url);
    return { data: { orders: [row(address("a"), address("b"))] } };
  });
  t.mock.method(globalThis, "fetch", async () => {
    assert.fail("The history query must not fetch token metadata");
  });
  const [overview, market] = await Promise.all([
    cache.fetchQuery(spotOverviewOrdersQueryOptions()),
    cache.fetchQuery(spotOverviewOrdersQueryOptions()),
  ]);
  assert.equal(overview.length, 1, "duplicate source rows are merged");
  assert.equal(market, overview);
  assert.equal(
    requests.length,
    2,
    "one parallel request for each order source",
  );
  await cache.fetchQuery(spotOverviewOrdersQueryOptions());
  assert.equal(requests.length, 2, "fresh route navigation reuses history");
  await cache.fetchQuery({ ...spotOverviewOrdersQueryOptions(), staleTime: 0 });
  assert.equal(
    requests.length,
    4,
    "explicit refresh still retrieves both sources",
  );
  cache.clear();
});

test("metadata requests only the active scope and reuses cache across equivalent views", async (t) => {
  const cache = client();
  const orders = [
    row(address("a"), address("b")),
    row(address("b"), address("a")),
  ];
  const requests: { addresses: string[]; chainId: number }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      requests.push(payload);
      return Response.json(
        payload.addresses.map((address: string) => ({
          address,
          symbol: "TOKEN",
          decimals: 18,
        })),
      );
    },
  );
  const options = spotOverviewTokensQueryOptions(cache, orders);
  const reversed = spotOverviewTokensQueryOptions(cache, [...orders].reverse());
  assert.deepEqual(options.queryKey, reversed.queryKey);
  await Promise.all([cache.fetchQuery(options), cache.fetchQuery(reversed)]);
  assert.deepEqual(requests, [
    { chainId: 1, addresses: [address("a"), address("b")] },
  ]);
  await cache.fetchQuery(spotOverviewTokensQueryOptions(cache, [orders[0]]));
  assert.equal(
    requests.length,
    1,
    "a smaller scope reuses individual cached tokens",
  );
  assert.ok(cache.getQueryData(tokenQueryKey(address("a"), 1)));
  const hidden = spotOverviewTokensQueryOptions(
    cache,
    [row(address("c"), address("d"))],
    false,
  );
  assert.equal(hidden.enabled, false);
  assert.deepEqual(hidden.queryKey, ["ops-overview-token-metadata", []]);
  assert.equal(cache.getQueryData(tokenQueryKey(address("c"), 1)), undefined);
  cache.clear();
});

test("embedded token symbols avoid redundant metadata requests only for matching addresses", () => {
  const cache = client();
  const order = row(address("a"), address("b"));
  order.metadata = {
    srcToken: { address: address("a"), symbol: "ALPHA", decimals: 18 },
    dstToken: { address: address("b"), symbol: "BETA", decimals: 18 },
  } as ListOrder["metadata"];
  assert.equal(spotOverviewTokensQueryOptions(cache, [order]).enabled, false);
  order.metadata.srcToken!.address = address("c");
  const missing = spotOverviewTokensQueryOptions(cache, [order]);
  assert.deepEqual(missing.queryKey, [
    "ops-overview-token-metadata",
    [{ address: address("a"), chainId: 1 }],
  ]);
  assert.equal(missing.enabled, true);
  delete (order.metadata.srcToken as Partial<typeof order.metadata.srcToken>)!
    .address;
  assert.deepEqual(
    spotOverviewTokensQueryOptions(cache, [order]).queryKey,
    missing.queryKey,
    "a symbol without an address cannot satisfy another token's metadata",
  );
  order.metadata.srcToken = {} as NonNullable<ListOrder["metadata"]["srcToken"]>;
  assert.deepEqual(
    spotOverviewTokensQueryOptions(cache, [order]).queryKey,
    missing.queryKey,
    "malformed inline token metadata leaves the original address available for lookup",
  );
  cache.clear();
});
