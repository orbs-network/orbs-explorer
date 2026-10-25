import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import axios from "axios";
import {
  CURRENT_SINK_API_URL,
  SINK_API_URLS,
  getAllOrdersForExchange,
} from "../packages/domain/src/twap/api";
import type { ListOrder } from "../packages/domain/src/twap/types";

const current = CURRENT_SINK_API_URL;
const original = SINK_API_URLS.prod;
const order = (id: number, chainId = 137, label = String(id)): ListOrder =>
  ({
    hash: `0x${id.toString(16).padStart(64, "0")}`,
    timestamp: "2026-10-22T10:00:00Z",
    exchangeAdapter: label,
    order: { witness: { chainId } },
  }) as ListOrder;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function mockPendingPages(t: TestContext) {
  const requests: { origin: string; page: number; signal?: AbortSignal }[] = [];
  const pending = new Map<string, ReturnType<typeof deferred<ListOrder[]>>>();
  const active = new Map<string, number>();
  const peak = new Map<string, number>();
  t.mock.method(
    axios,
    "get",
    (raw: string, options: { signal?: AbortSignal }) => {
      const url = new URL(raw);
      const page = Number(url.searchParams.get("page"));
      assert.equal(url.searchParams.get("view"), "list");
      assert.equal(url.searchParams.get("exchange"), "test & exchange");
      requests.push({ origin: url.origin, page, signal: options.signal });
      const request = deferred<ListOrder[]>();
      pending.set(`${url.origin}:${page}`, request);
      active.set(url.origin, (active.get(url.origin) ?? 0) + 1);
      peak.set(
        url.origin,
        Math.max(peak.get(url.origin) ?? 0, active.get(url.origin)!),
      );
      const abort = () => request.reject(options.signal!.reason);
      options.signal?.addEventListener("abort", abort, { once: true });
      return request.promise
        .then((orders) => ({ data: { orders } }))
        .finally(() => {
          active.set(url.origin, active.get(url.origin)! - 1);
          options.signal?.removeEventListener("abort", abort);
        });
    },
  );
  const page = (origin: string, number: number) => {
    const request = pending.get(`${origin}:${number}`);
    assert.ok(request, `Page ${number} was not requested from ${origin}`);
    return request;
  };
  return { requests, page, peak };
}

test("complete history bounds each source to three later pages and preserves page/source precedence", async (t) => {
  const { requests, page, peak } = mockPendingPages(t);
  const result = getAllOrdersForExchange({
    exchange: "test & exchange",
    limit: 1,
  });
  assert.deepEqual(
    requests.map(({ origin, page }) => [origin, page]),
    [
      [current, 1],
      [original, 1],
    ],
  );

  page(current, 1).resolve([order(1)]);
  page(original, 1).resolve([order(1, 8453)]);
  await setImmediate();
  for (const origin of [current, original]) {
    assert.deepEqual(
      requests
        .filter((request) => request.origin === origin)
        .map(({ page }) => page),
      [1, 2, 3, 4],
    );
    assert.equal(peak.get(origin), 3);
  }

  // Later pages finish first. Neither the next window nor duplicate selection
  // can depend on completion order.
  page(current, 4).resolve([order(4)]);
  page(current, 3).resolve([order(2, 137, "later duplicate")]);
  page(original, 4).resolve([]);
  page(original, 3).resolve([]);
  page(original, 2).resolve([order(2, 137, "original duplicate")]);
  await setImmediate();
  assert.equal(requests.length, 8);

  page(current, 2).resolve([order(2, 137, "first duplicate")]);
  await setImmediate();
  assert.deepEqual(
    requests.filter(({ origin }) => origin === current).map(({ page }) => page),
    [1, 2, 3, 4, 5, 6, 7],
  );
  page(current, 7).resolve([]);
  page(current, 6).resolve([]);
  page(current, 5).resolve([]);
  const orders = await result;
  assert.deepEqual(
    orders.map((record) => [
      record.exchangeAdapter,
      record.order.witness.chainId,
      record.source,
    ]),
    [
      ["1", 137, "v2"],
      ["first duplicate", 137, "v2"],
      ["4", 137, "v2"],
      ["1", 8453, "v1"],
    ],
  );
  assert.equal(peak.get(current), 3);
  assert.equal(peak.get(original), 3);
});

test("a short first page avoids extra work and a short later page ends its source", async (t) => {
  const requests: string[] = [];
  t.mock.method(axios, "get", async (raw: string) => {
    const url = new URL(raw);
    const page = Number(url.searchParams.get("page"));
    requests.push(`${url.origin}:${page}`);
    const orders =
      url.origin === original
        ? [order(8)]
        : page === 1
          ? [order(1), order(2)]
          : page === 2
            ? [order(3)]
            : [];
    return { data: { orders } };
  });
  const orders = await getAllOrdersForExchange({ exchange: "", limit: 2 });
  assert.deepEqual(
    orders.map(({ exchangeAdapter }) => exchangeAdapter),
    ["1", "2", "3", "8"],
  );
  assert.deepEqual(requests, [
    `${current}:1`,
    `${original}:1`,
    `${current}:2`,
    `${current}:3`,
    `${current}:4`,
  ]);
});

test("an already aborted history load issues no requests", async (t) => {
  const { requests } = mockPendingPages(t);
  const controller = new AbortController();
  const reason = new Error("history cancelled before loading");
  controller.abort(reason);
  await assert.rejects(
    getAllOrdersForExchange({
      exchange: "test & exchange",
      signal: controller.signal,
    }),
    (error) => error === reason,
  );
  assert.equal(requests.length, 0);
});

test("aborting a parallel window cancels every request and never starts another window", async (t) => {
  const { requests, page } = mockPendingPages(t);
  const controller = new AbortController();
  const result = getAllOrdersForExchange({
    exchange: "test & exchange",
    limit: 1,
    signal: controller.signal,
  });
  page(current, 1).resolve([order(1)]);
  page(original, 1).resolve([]);
  await setImmediate();
  assert.equal(requests.length, 5);
  assert.ok(requests.every(({ signal }) => signal === controller.signal));
  const reason = new Error("history cancelled during loading");
  const rejected = assert.rejects(result, (error) => error === reason);
  controller.abort(reason);
  await rejected;
  await setImmediate();
  assert.equal(requests.length, 5);
});

for (const failedPage of [2, 4]) {
  test(`failure on parallel page ${failedPage} rejects complete history, including speculative tail pages`, async (t) => {
    const { requests, page } = mockPendingPages(t);
    const result = getAllOrdersForExchange({
      exchange: "test & exchange",
      limit: 1,
    });
    page(current, 1).resolve([order(1)]);
    page(original, 1).resolve([order(8)]);
    await setImmediate();
    const reason = new Error(`page ${failedPage} unavailable`);
    const rejected = assert.rejects(result, (error) => error === reason);
    for (const number of [2, 3, 4]) {
      if (number === failedPage) page(current, number).reject(reason);
      else page(current, number).resolve([]);
      page(original, number).resolve([]);
    }
    await rejected;
    await setImmediate();
    assert.equal(requests.length, 8);
  });
}
