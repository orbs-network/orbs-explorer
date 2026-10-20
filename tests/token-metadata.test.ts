import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { zeroAddress } from "viem";
import {
  preloadTokenMetadata,
  tokenQueryKey,
  TOKEN_FAILURE_STALE_TIME,
} from "../src/lib/token-metadata";
import { getTwapTokenReferences } from "../src/lib/twap/token-metadata";
import type { Token } from "../src/lib/types";
import type { ListOrder, Order } from "../src/lib/twap/types";

const a = `0x${"a".repeat(40)}`;
const b = `0x${"b".repeat(40)}`;
const token = (address: string, symbol = "USDC"): Token => ({
  address,
  symbol,
  decimals: 6,
  name: "USDC",
});
const client = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
const read = (cache: QueryClient, address: string, chainId: number) =>
  cache.getQueryData<Token | null>(tokenQueryKey(address, chainId));
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("preloads unique tokens in parallel and waits for every network, including failures", async (t) => {
  const cache = client();
  const requests: { chainId: number; addresses: string[] }[] = [];
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      requests.push(payload);
      if (payload.chainId === 8453) {
        await pending;
        return new Response("Unavailable", { status: 502 });
      }
      // The service omits a failed lookup, so response positions aren't reliable.
      return Response.json([
        token(b.toUpperCase().replace("0X", "0x"), "RESOLVED"),
      ]);
    },
  );
  const references = [
    { address: a, chainId: 1 },
    { address: b, chainId: 1 },
    { address: b.toUpperCase().replace("0X", "0x"), chainId: 1 },
    { address: b, chainId: 8453 },
    { address: "invalid", chainId: 1 },
  ];
  let complete = false;
  const preload = preloadTokenMetadata(cache, references).then(() => {
    complete = true;
  });
  await tick();
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], { chainId: 1, addresses: [a, b] });
  assert.equal(complete, false);
  assert.equal(read(cache, b, 1), undefined);
  release();
  await preload;
  assert.equal(read(cache, b, 1)?.symbol, "RESOLVED");
  assert.equal(read(cache, a, 1), null);
  assert.equal(read(cache, b, 8453), null);
  assert.match(read(cache, b, 1)?.logoUrl ?? "", /usd-coin.png$/);
  await preloadTokenMetadata(cache, references);
  assert.equal(
    requests.length,
    2,
    "reuse both success and recently settled failure caches",
  );
});

test("native symbols resolve locally even if another token on the network fails", async (t) => {
  const cache = client();
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    throw new Error("RPC offline");
  });
  await preloadTokenMetadata(cache, [
    { address: zeroAddress, chainId: 1 },
    { address: a, chainId: 1 },
    { address: zeroAddress, chainId: 987654321 },
    { address: a, chainId: 0 },
    { address: a },
    { chainId: 1 },
  ]);
  assert.equal(requests, 1);
  assert.equal(read(cache, zeroAddress, 1)?.symbol, "ETH");
  assert.equal(read(cache, zeroAddress, 1)?.decimals, 18);
  assert.equal(read(cache, a, 1), null);
  assert.equal(read(cache, zeroAddress, 987654321), null);
  assert.equal(read(cache, a, 0), undefined);
});

test("large networks use bounded batches and retain healthy batches when one fails", async (t) => {
  const cache = client();
  const sizes: number[] = [];
  const addresses = Array.from(
    { length: 103 },
    (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`,
  );
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      const { addresses } = JSON.parse(init.body as string);
      sizes.push(addresses.length);
      return Response.json(
        addresses.length === 100
          ? addresses.map((address: string) => token(address))
          : { error: "Invalid response" },
      );
    },
  );
  await preloadTokenMetadata(
    cache,
    addresses.map((address) => ({ address, chainId: 1 })),
  );
  assert.deepEqual(sizes, [100, 3]);
  assert.equal(read(cache, addresses[99], 1)?.symbol, "USDC");
  assert.equal(read(cache, addresses[100], 1), null);
});

test("unavailable tokens retry after a short cache period while known symbols stay cached", async (t) => {
  const cache = client();
  cache.setQueryData(tokenQueryKey(a, 1), token(a));
  cache.setQueryData(tokenQueryKey(b, 1), null, {
    updatedAt: Date.now() - TOKEN_FAILURE_STALE_TIME - 1,
  });
  const requests: string[][] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      const { addresses } = JSON.parse(init.body as string);
      requests.push(addresses);
      return Response.json([token(b)]);
    },
  );
  await preloadTokenMetadata(cache, [
    { address: a, chainId: 1 },
    { address: b, chainId: 1 },
  ]);
  assert.deepEqual(requests, [[b]]);
  assert.equal(read(cache, b, 1)?.symbol, "USDC");
});

test("cancelled preloads never publish partial or failed metadata", async (t) => {
  const cache = client();
  const controller = new AbortController();
  let requests = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      requests++;
      const { chainId } = JSON.parse(init.body as string);
      if (chainId === 1) return Response.json([token(a)]);
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
    },
  );
  const preload = preloadTokenMetadata(
    cache,
    [
      { address: a, chainId: 1 },
      { address: b, chainId: 8453 },
    ],
    controller.signal,
  );
  await tick();
  assert.equal(requests, 2);
  controller.abort(new Error("Page left"));
  await assert.rejects(preload, /Page left/);
  assert.equal(read(cache, a, 1), undefined);
  assert.equal(read(cache, b, 8453), undefined);
  await assert.rejects(
    preloadTokenMetadata(
      cache,
      [{ address: a, chainId: 1 }],
      controller.signal,
    ),
    /Page left/,
  );
  assert.equal(requests, 2);
});

test("metadata with an empty symbol retries after the failure cache expires", async (t) => {
  const cache = client();
  cache.setQueryData(tokenQueryKey(a, 1), token(a, " "));
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json([token(a, "RECOVERED")]);
  });
  await preloadTokenMetadata(cache, [{ address: a, chainId: 1 }]);
  assert.equal(requests, 0, "avoid immediate retries for partial metadata");
  cache.setQueryData(tokenQueryKey(a, 1), token(a, " "), {
    updatedAt: Date.now() - TOKEN_FAILURE_STALE_TIME - 1,
  });
  await preloadTokenMetadata(cache, [{ address: a, chainId: 1 }]);
  assert.equal(requests, 1);
  assert.equal(read(cache, a, 1)?.symbol, "RECOVERED");
});

test("partial metadata cannot overwrite a symbol resolved during a preload", async (t) => {
  const cache = client();
  t.mock.method(globalThis, "fetch", async () => {
    cache.setQueryData(tokenQueryKey(a, 1), token(a, "RESOLVED"));
    return Response.json([token(a, "")]);
  });
  await preloadTokenMetadata(cache, [{ address: a, chainId: 1 }]);
  assert.equal(read(cache, a, 1)?.symbol, "RESOLVED");
});

test("collects tokens from list rows and detailed order trade history using either chain field", () => {
  const list = {
    inputToken: a,
    outputToken: b,
    order: { witness: { chainId: 1 } },
  } as ListOrder;
  const detail = {
    order: {
      witness: { chainid: 8453, input: { token: a }, output: { token: b } },
    },
    metadata: { chunks: [{ inToken: zeroAddress, outToken: b }] },
  } as unknown as Order;
  assert.deepEqual(getTwapTokenReferences([list, detail]), [
    { address: a, chainId: 1 },
    { address: b, chainId: 1 },
    { address: a, chainId: 8453 },
    { address: b, chainId: 8453 },
    { address: zeroAddress, chainId: 8453 },
    { address: b, chainId: 8453 },
  ]);
  delete (detail.metadata as Partial<Order["metadata"]>).chunks;
  assert.deepEqual(getTwapTokenReferences([detail]), [
    { address: a, chainId: 8453 },
    { address: b, chainId: 8453 },
  ]);
});

test("a concurrent failed preload cannot replace metadata loaded successfully elsewhere", async (t) => {
  const cache = client();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  t.mock.method(globalThis, "fetch", async () => {
    await pending;
    return new Response("RPC unavailable", { status: 502 });
  });
  const preload = preloadTokenMetadata(cache, [{ address: a, chainId: 1 }]);
  cache.setQueryData(tokenQueryKey(a, 1), token(a));
  release();
  await preload;
  assert.equal(read(cache, a, 1)?.symbol, "USDC");
});
