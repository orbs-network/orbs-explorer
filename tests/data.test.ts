import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import axios from "axios";
import {
  getSpotConfig,
  getSpotOrder,
  getSpotOrdersPage,
  getAllOrdersForExchangeAndChain,
  CURRENT_SINK_API_URL,
  SINK_API_URLS,
} from "../src/lib/twap/api";
import {
  getMinAmountPerChunk,
  getSpotOrderType,
  getSpotOrderTriggerPricePerChunk,
  getOrderStatus,
} from "../src/lib/twap/utils";
import type { ListOrder, Order } from "../src/lib/twap/types";
import { SpotOrderType, Status } from "../src/lib/twap/types";
import { availableResults } from "../src/lib/perpetual-hub/available-results";
import { appendPerpetualHubScope } from "../src/lib/perpetual-hub/query-scope";

const hash = `0x${"a".repeat(64)}`;
const listOrder = (chainId = 137): ListOrder =>
  ({
    hash,
    timestamp: "2026-10-13T10:00:00Z",
    order: { witness: { chainId } },
  }) as ListOrder;
const order = (
  output: Record<string, string> = {},
  expectedChunks = 1,
): Order =>
  ({
    hash,
    order: {
      witness: {
        output: { limit: "1", ...output },
        input: { amount: "10", maxAmount: "100" },
      },
    },
    metadata: { expectedChunks, chunks: [], status: "pending" },
  }) as unknown as Order;

function mockOrders(t: TestContext, callback: (url: URL) => unknown[]) {
  t.mock.method(axios, "get", async (url: string) => ({
    data: { orders: callback(new URL(url)) },
  }));
}

test("lists query each service once, encode filters, and retain pagination across sources", async (t) => {
  const requests: URL[] = [];
  mockOrders(t, (url) => {
    requests.push(url);
    return url.origin === CURRENT_SINK_API_URL ? [listOrder()] : [];
  });
  const page = await getSpotOrdersPage({
    filters: {
      chainIds: [137, 8453],
      account: ["alice", "bob"],
      exchange: "sushi & partner",
    },
    limit: 1,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("page"), "1");
  assert.equal(requests[0].searchParams.get("chainId"), "137,8453");
  assert.equal(requests[0].searchParams.get("swapper"), "alice,bob");
  assert.equal(requests[0].searchParams.get("exchange"), "sushi & partner");
  assert.equal(page.orders[0].source, "v2");
  assert.equal(page.hasMore, true);
});

test("deduplicates across sources while retaining different chains", async (t) => {
  mockOrders(t, (url) =>
    url.origin === CURRENT_SINK_API_URL
      ? [listOrder(137), listOrder(8453)]
      : [listOrder(137)],
  );
  const page = await getSpotOrdersPage({ filters: {} });
  assert.equal(page.orders.length, 2);
  assert.equal(page.orders[0].source, "v2");
  assert.equal(page.hasMore, false);
});

test("a partial history failure keeps available orders and reports the missing service", async (t) => {
  mockOrders(t, (url) => {
    if (url.origin === SINK_API_URLS.prod) throw new Error("unavailable");
    return [listOrder()];
  });
  const page = await getSpotOrdersPage({ filters: {} });
  assert.equal(page.orders.length, 1);
  assert.equal(page.warnings.length, 1);
});

test("total history failure and cancellation remain errors", async (t) => {
  mockOrders(t, () => {
    throw new Error("unavailable");
  });
  await assert.rejects(getSpotOrdersPage({ filters: {} }), /unavailable/);
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  await assert.rejects(
    getSpotOrdersPage({ filters: {}, signal: controller.signal }),
    /cancelled/,
  );
});

test("overview continues paging each source independently", async (t) => {
  const pages: string[] = [];
  mockOrders(t, (url) => {
    pages.push(`${url.origin}:${url.searchParams.get("page")}`);
    if (url.origin === CURRENT_SINK_API_URL) return [];
    return url.searchParams.get("page") === "1" ? [listOrder()] : [];
  });
  const orders = await getAllOrdersForExchangeAndChain({
    exchange: "sushi",
    chainId: 137,
    limit: 1,
  });
  assert.equal(orders.length, 1);
  assert.ok(pages.includes(`${SINK_API_URLS.prod}:2`));
  assert.ok(!pages.includes(`${CURRENT_SINK_API_URL}:2`));
});

test("a missing order is confirmed only when all searched sources succeed", async (t) => {
  mockOrders(t, () => []);
  assert.equal(await getSpotOrder({ hash }), undefined);
});

test("detail lookups respect the source selected from the list", async (t) => {
  const requests: URL[] = [];
  mockOrders(t, (url) => {
    requests.push(url);
    return [order()];
  });
  const detail = await getSpotOrder({ hash, source: "v2" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].origin, CURRENT_SINK_API_URL);
  assert.equal(detail?.source, "v2");
});

test("current trigger fields and expected chunks classify unfilled orders correctly", () => {
  assert.equal(getMinAmountPerChunk(order()), "0");
  assert.equal(
    getMinAmountPerChunk(order({ triggerUpper: "120", limit: "50" })),
    "50",
  );
  assert.equal(
    getSpotOrderType(order({ limit: "50" }, 10)),
    SpotOrderType.TWAP_LIMIT,
  );
  assert.equal(
    getSpotOrderType(order({ triggerUpper: "120" })),
    SpotOrderType.TAKE_PROFIT,
  );
  assert.equal(
    getSpotOrderTriggerPricePerChunk(
      order({ triggerUpper: "120", limit: "1" }),
    ),
    "120",
  );
  assert.equal(
    getSpotOrderType(order({ triggerLower: "80", limit: "50" })),
    SpotOrderType.STOP_LOSS_LIMIT,
  );
  assert.equal(
    getSpotOrderTriggerPricePerChunk(order({ triggerLower: "80" })),
    "80",
  );
  const cancelled = order();
  cancelled.metadata.status = "cancelled";
  assert.equal(getOrderStatus(cancelled), Status.CANCELLED);
});

test("deployment aggregation retains healthy data and rejects total outages", async () => {
  const result = await availableResults(
    [Promise.resolve([1]), Promise.reject(new Error("offline"))],
    ["Arbitrum", "Polygon"],
  );
  assert.deepEqual(result.data, [[1]]);
  assert.match(result.warnings[0], /Polygon/);
  await assert.rejects(
    availableResults([Promise.reject(new Error("offline"))], ["Polygon"]),
    /unavailable/,
  );
});

test("perpetual navigation preserves deployment scope while clearing unrelated filters", () => {
  const source = new URLSearchParams(
    "partner_id=thena&chain_id=42161&contract=0xabc&symbol=ETHUSDT",
  );
  const destination = new URL(
    appendPerpetualHubScope("/perpetual-hub/users", source),
    "http://localhost",
  );
  assert.equal(destination.searchParams.get("partner_id"), "thena");
  assert.equal(destination.searchParams.get("chain_id"), "42161");
  assert.equal(destination.searchParams.has("symbol"), false);
});

test("partner configuration inherits universal adapters without replacing chain-specific adapters", async (t) => {
  t.mock.method(axios, "get", async () => ({
    data: {
      "*": {
        dex: {
          agent: { adapter: "0xshared", fee: "0xfee", type: "universal" },
        },
      },
      "137": {
        dex: { agent: { adapter: "0xpolygon", fee: "0xfee", type: "default" } },
      },
      "8453": { dex: {} },
    },
  }));
  const config = await getSpotConfig();
  assert.equal(config["137"].dex?.agent.adapter, "0xpolygon");
  assert.equal(config["8453"].dex?.agent.adapter, "0xshared");
});
