import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import { historyExchangeForPartners } from "../apps/ops/src/lib/spot-history-scope";
import { tokenQueryKey } from "../packages/domain/src/token-metadata";
import {
  spotOverviewOrdersQueryOptions,
  spotOverviewTokensQueryOptions,
  spotSwapperOrdersQueryOptions,
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

test("partner requests include historical adapters and respect selected networks", () => {
  const config = {
    "1": {
      dex: { sushiswap: { adapter: address("a") } },
      partnerAdapters: [
        {
          partnerId: "sushiswap",
          partnerName: "SushiSwap",
          adapter: address("b"),
        },
      ],
    },
    "137": {
      dex: {
        sushiswap: { adapter: address("c") },
        quickswap: { adapter: address("d") },
      },
    },
  } as unknown as SpotConfig;
  assert.equal(
    historyExchangeForPartners(config, ["sushiswap"]),
    [address("a"), address("b"), address("c")].join(","),
  );
  assert.equal(
    historyExchangeForPartners(config, ["sushiswap"], ["1"]),
    [address("a"), address("b")].join(","),
  );
  assert.equal(
    historyExchangeForPartners(config, [`adapter-${address("e")}`]),
    address("e"),
  );
  assert.equal(historyExchangeForPartners(null, ["unresolved"]), undefined);
});

test("swapper membership queries normalize addresses and isolate cache by wallet and history snapshot", async (t) => {
  const cache = client();
  const requests: string[] = [];
  t.mock.method(axios, "get", async (url: string) => {
    requests.push(url);
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("view"), "list");
    assert.ok(
      [address("a"), address("b")].includes(
        parsed.searchParams.get("swapper")!,
      ),
    );
    return { data: { orders: [row(address("c"), address("d"))] } };
  });
  const options = spotSwapperOrdersQueryOptions(
    ` ${address("a").toUpperCase().replace("0X", "0x")} `,
    100,
  );
  const same = spotSwapperOrdersQueryOptions(address("a"), 100);
  assert.deepEqual(options.queryKey, same.queryKey);
  const [first, second] = await Promise.all([
    cache.fetchQuery(options),
    cache.fetchQuery(same),
  ]);
  assert.equal(first, second);
  assert.equal(requests.length, 2);
  await cache.fetchQuery(spotSwapperOrdersQueryOptions(address("b"), 100));
  await cache.fetchQuery(spotSwapperOrdersQueryOptions(address("a"), 200));
  assert.equal(requests.length, 6);
  assert.equal(spotSwapperOrdersQueryOptions("", 100).enabled, false);
  assert.equal(spotSwapperOrdersQueryOptions("0x123", 100).enabled, false);
  assert.equal(spotSwapperOrdersQueryOptions(address("a"), 0).enabled, false);
  cache.clear();
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

test("history caches isolate periods and filters while equivalent scopes reuse requests", async (t) => {
  const cache = client();
  const requests: URL[] = [];
  t.mock.method(axios, "get", async (raw: string) => {
    requests.push(new URL(raw));
    return {
      data: {
        orders: [
          {
            ...row(address("a"), address("b")),
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  });
  const day = spotOverviewOrdersQueryOptions({
    days: 1,
    chainIds: ["137", "1", "137"],
    exchange: `${address("B")},${address("a")}`,
  });
  const equivalent = spotOverviewOrdersQueryOptions({
    days: 1,
    chainIds: ["1", "137"],
    exchange: `${address("a")},${address("b")}`,
  });
  assert.deepEqual(day.queryKey, equivalent.queryKey);
  await Promise.all([cache.fetchQuery(day), cache.fetchQuery(equivalent)]);
  assert.equal(requests.length, 2);
  await cache.fetchQuery(spotOverviewOrdersQueryOptions({ days: 7 }));
  assert.equal(requests.length, 4, "a different period has its own snapshot");
  await cache.fetchQuery(
    spotOverviewOrdersQueryOptions({
      days: 1,
      swapper: address("c"),
      source: "v2",
    }),
  );
  assert.equal(
    requests.length,
    5,
    "an explicit source requests only that service",
  );
  assert.equal(requests[4].searchParams.get("swapper"), address("c"));
  assert.equal(requests[0].searchParams.get("chainId"), "1,137");
  cache.clear();
});

test("24-hour history excludes older records while the overview can request its two-day comparison window", async (t) => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  t.mock.method(Date, "now", () => now);
  t.mock.method(axios, "get", async () => ({
    data: {
      orders: [0.5, 1.5, 3].map((age, index) => ({
        ...row(address("a"), address("b")),
        hash: `0x${index}`,
        timestamp: new Date(now - age * 86_400_000).toISOString(),
      })),
    },
  }));
  const cache = client();
  assert.equal(
    (await cache.fetchQuery(spotOverviewOrdersQueryOptions({ days: 1 })))
      .length,
    1,
  );
  assert.equal(
    (await cache.fetchQuery(spotOverviewOrdersQueryOptions({ days: 2 })))
      .length,
    2,
  );
  assert.equal(
    (await cache.fetchQuery(spotOverviewOrdersQueryOptions())).length,
    3,
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
  order.metadata.srcToken = {} as NonNullable<
    ListOrder["metadata"]["srcToken"]
  >;
  assert.deepEqual(
    spotOverviewTokensQueryOptions(cache, [order]).queryKey,
    missing.queryKey,
    "malformed inline token metadata leaves the original address available for lookup",
  );
  cache.clear();
});
