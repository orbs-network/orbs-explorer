import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import {
  getSpotOrdersForScope,
  CURRENT_SINK_API_URL,
  SINK_API_URLS,
} from "../packages/domain/src/twap/api";
import type { ListOrder } from "../packages/domain/src/twap/types";

const row = (id: number, time: number | string, chainId = 1): ListOrder =>
  ({
    hash: `0x${id.toString(16).padStart(64, "0")}`,
    timestamp: typeof time === "number" ? new Date(time).toISOString() : time,
    exchangeAdapter: String(id),
    order: { witness: { chainId } },
  }) as ListOrder;
const day = 86_400_000;
const now = Date.parse("2026-10-26T12:00:00Z");

test("bounded history stops each source at the cutoff without speculative older pages", async (t) => {
  const requests: URL[] = [];
  const since = now - day;
  t.mock.method(axios, "get", async (raw: string) => {
    const url = new URL(raw);
    requests.push(url);
    const page = Number(url.searchParams.get("page"));
    const orders =
      url.origin === SINK_API_URLS.prod
        ? [row(9, now - 10 * day), row(10, now - 11 * day)]
        : page === 1
          ? [row(1, now), row(2, since)]
          : [row(3, since), row(4, since - 1)];
    return { data: { orders } };
  });
  const rows = await getSpotOrdersForScope({ fromTimestamp: since, limit: 2 });
  assert.deepEqual(
    rows.map((order) => order.exchangeAdapter),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    requests.map((url) => [url.origin, url.searchParams.get("page")]),
    [
      [CURRENT_SINK_API_URL, "1"],
      [SINK_API_URLS.prod, "1"],
      [CURRENT_SINK_API_URL, "2"],
    ],
  );
  assert.ok(
    requests.every((url) => !url.searchParams.has("since")),
    "unsupported date parameters must never imply server-side filtering",
  );
});

test("an older custom interval scans through newer pages and retains all supported request filters", async (t) => {
  const requests: URL[] = [];
  const swapper = `0x${"a".repeat(40)}`;
  const exchange = `0x${"b".repeat(40)},0x${"c".repeat(40)}`;
  t.mock.method(axios, "get", async (raw: string) => {
    const url = new URL(raw);
    requests.push(url);
    assert.equal(url.origin, CURRENT_SINK_API_URL);
    assert.equal(url.searchParams.get("swapper"), swapper);
    assert.equal(url.searchParams.get("exchange"), exchange);
    assert.equal(url.searchParams.get("chainId"), "1,137");
    const page = Number(url.searchParams.get("page"));
    return {
      data: {
        orders:
          page === 1
            ? [row(1, now), row(2, now - day)]
            : [row(3, now - 2 * day), row(4, now - 4 * day)],
      },
    };
  });
  const rows = await getSpotOrdersForScope({
    fromTimestamp: now - 3 * day,
    untilTimestamp: now - 2 * day,
    source: "v2",
    chainIds: [1, 137],
    exchange,
    swapper,
    limit: 2,
  });
  assert.deepEqual(
    rows.map((order) => order.exchangeAdapter),
    ["3"],
  );
  assert.equal(requests.length, 2);
});

test("scoped history preserves current-service duplicate precedence", async (t) => {
  t.mock.method(axios, "get", async (raw: string) => ({
    data: { orders: [row(1, now)] },
  }));
  const rows = await getSpotOrdersForScope({ fromTimestamp: now - day });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, "v2");
});

test("malformed or unsorted timestamps disable early stopping instead of hiding later in-range records", async (t) => {
  t.mock.method(axios, "get", async (raw: string) => {
    const url = new URL(raw),
      page = Number(url.searchParams.get("page"));
    return {
      data: {
        orders:
          page === 1
            ? [row(1, "unknown"), row(2, now - 10 * day)]
            : page === 2
              ? [row(3, now), row(4, now - day)]
              : [],
      },
    };
  });
  const rows = await getSpotOrdersForScope({
    fromTimestamp: now - 2 * day,
    source: "v2",
    limit: 2,
  });
  assert.deepEqual(
    rows.map((order) => order.exchangeAdapter),
    ["3", "4"],
  );
});

test("a scoped page failure rejects totals rather than returning a partial scope", async (t) => {
  t.mock.method(axios, "get", async (raw: string) => {
    const url = new URL(raw);
    if (url.origin === SINK_API_URLS.prod)
      throw new Error("legacy unavailable");
    return { data: { orders: [row(1, now)] } };
  });
  await assert.rejects(
    getSpotOrdersForScope({ fromTimestamp: now - day }),
    /legacy unavailable/,
  );
});

test("changing a scope can abort in-flight paging and prevents later page requests", async (t) => {
  const controller = new AbortController();
  const requests: string[] = [];
  t.mock.method(
    axios,
    "get",
    async (raw: string, options: { signal: AbortSignal }) => {
      requests.push(raw);
      assert.equal(options.signal, controller.signal);
      controller.abort(new Error("range changed"));
      return { data: { orders: [row(1, now), row(2, now - day)] } };
    },
  );
  await assert.rejects(
    getSpotOrdersForScope({
      fromTimestamp: now - 2 * day,
      source: "v2",
      limit: 2,
      signal: controller.signal,
    }),
    /range changed/,
  );
  assert.equal(requests.length, 1);
});

test("empty and invalid ranges never trigger history requests", async (t) => {
  t.mock.method(axios, "get", async () => assert.fail("No request expected"));
  assert.deepEqual(
    await getSpotOrdersForScope({
      fromTimestamp: now,
      untilTimestamp: now - 1,
    }),
    [],
  );
  await assert.rejects(
    getSpotOrdersForScope({ fromTimestamp: NaN }),
    /Invalid order placement range/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(getSpotOrdersForScope({ signal: controller.signal }));
});
