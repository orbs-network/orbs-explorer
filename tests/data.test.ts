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
  SPOT_CONFIG_URL,
} from "../packages/domain/src/twap/api";
import { getSpotPartnerIdentity } from "../packages/domain/src/twap/partner-catalog";
import {
  getMinAmountPerChunk,
  getSpotOrderType,
  getSpotOrderTriggerPricePerChunk,
  getOrderStatus,
} from "../packages/domain/src/twap/utils";
import type {
  ListOrder,
  Order,
  SpotConfig,
} from "../packages/domain/src/twap/types";
import { SpotOrderType, Status } from "../packages/domain/src/twap/types";
import { availableResults } from "../packages/domain/src/perpetual-hub/available-results";
import { appendPerpetualHubScope } from "../packages/domain/src/perpetual-hub/query-scope";

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
  const sharedAdapter = `0x${"1".repeat(40)}`;
  const polygonAdapter = `0x${"2".repeat(40)}`;
  t.mock.method(axios, "get", async (url: string) => ({
    data:
      url === SPOT_CONFIG_URL
        ? {
            "*": {
              dex: {
                agent: {
                  adapter: sharedAdapter,
                  fee: "0xfee",
                  type: "universal",
                },
              },
            },
            "137": {
              dex: {
                agent: {
                  adapter: polygonAdapter,
                  fee: "0xfee",
                  type: "default",
                },
              },
            },
            "8453": { dex: {} },
          }
        : {
            chains: [
              {
                chainId: 137,
                exchanges: [{ name: "Agent-old-1", address: sharedAdapter }],
              },
              {
                chainId: 8453,
                exchanges: [
                  { name: "Conflicting app", address: sharedAdapter },
                ],
              },
            ],
          },
  }));
  const config = await getSpotConfig();
  assert.equal(config["137"].dex?.agent.adapter, polygonAdapter);
  assert.equal(config["8453"].dex?.agent.adapter, sharedAdapter);
  assert.deepEqual(
    config["137"].partnerAdapters?.map((item) => item.partnerId),
    ["agent"],
  );
  assert.equal(config["8453"].partnerAdapters, undefined);
});

const blackholeAdapter = "0xccdF1D6ce95FeC0F842197470CE8969A678B0A04";
const oldBlackholeAdapter = "0x426ec4bc0d58B80959CDE77576a1942dd40592Fa";
const reusedAdapter = "0x023fD6848234f2655818705237F77F02215FEfe5";
const configuredSpot = (): SpotConfig => ({
  "*": { dex: {} },
  "43114": {
    dex: {
      blackhole: { adapter: blackholeAdapter, fee: "0xfee", type: "default" },
    },
  },
});
const statusCatalog = (
  exchanges = [{ name: "Blackhole-old-1", address: oldBlackholeAdapter }],
  chainId = 43114,
) => ({ chains: [{ chainId, chainName: "network", exchanges }] });

test("partner configuration loads current and historical app identities without changing active protocol adapters", async (t) => {
  const requests: string[] = [];
  t.mock.method(
    axios,
    "get",
    async (url: string, options: { timeout: number }) => {
      requests.push(url);
      assert.equal(options.timeout, 20_000);
      return {
        data: url === SPOT_CONFIG_URL ? configuredSpot() : statusCatalog(),
      };
    },
  );
  const config = await getSpotConfig();
  assert.deepEqual(requests, [
    SPOT_CONFIG_URL,
    `${CURRENT_SINK_API_URL}/status`,
    `${SINK_API_URLS.prod}/status`,
  ]);
  assert.equal(config["43114"].dex?.blackhole.adapter, blackholeAdapter);
  assert.deepEqual(config["43114"].partnerAdapters, [
    {
      partnerId: "blackhole",
      partnerName: "Blackhole",
      adapter: oldBlackholeAdapter,
    },
  ]);
  assert.equal("fee" in config["43114"].partnerAdapters![0], false);
});

test("historical identities remain network-specific and normalize known app aliases", async (t) => {
  t.mock.method(axios, "get", async (url: string) => ({
    data:
      url === SPOT_CONFIG_URL
        ? { "*": { dex: {} } }
        : {
            chains: [
              {
                chainId: 137,
                exchanges: [{ name: "Quick-old-1", address: reusedAdapter }],
              },
              {
                chainId: 42161,
                exchanges: [{ name: "Ramses-old-1", address: reusedAdapter }],
              },
            ],
          },
  }));
  const config = await getSpotConfig();
  assert.equal(config["137"].partnerAdapters?.[0].partnerId, "quickswap");
  assert.equal(config["137"].partnerAdapters?.[0].partnerName, "Quickswap");
  assert.equal(config["42161"].partnerAdapters?.[0].partnerId, "ramses");
  assert.equal(config["42161"].partnerAdapters?.[0].partnerName, "Ramses");
  assert.deepEqual(getSpotPartnerIdentity("Dragon-old-2"), {
    partnerId: "dragonswap",
    partnerName: "DragonSwap",
  });
  assert.equal(getSpotPartnerIdentity("Spooky").partnerId, "spookyswap");
});

test("historical identity matches configured custom IDs without changing their route casing", async (t) => {
  t.mock.method(axios, "get", async (url: string) => ({
    data:
      url === SPOT_CONFIG_URL
        ? {
            "*": { dex: {} },
            "43114": {
              dex: {
                CustomDex: {
                  adapter: blackholeAdapter,
                  type: "default",
                  fee: "0xfee",
                },
              },
            },
          }
        : statusCatalog([
            { name: "customdex-old-1", address: oldBlackholeAdapter },
          ]),
  }));
  const config = await getSpotConfig();
  assert.equal(config["43114"].partnerAdapters?.[0].partnerId, "CustomDex");
});

test("ambiguous historical adapters are excluded while exact current mappings take precedence", async (t) => {
  const conflictCatalog = statusCatalog([
    { name: "Arbidex", address: reusedAdapter },
    { name: "Chronos-old-1", address: reusedAdapter.toLowerCase() },
    { name: "Pangolin", address: blackholeAdapter },
    { name: "Blackhole", address: oldBlackholeAdapter },
  ]);
  t.mock.method(axios, "get", async (url: string) => ({
    data: url === SPOT_CONFIG_URL ? configuredSpot() : conflictCatalog,
  }));
  const config = await getSpotConfig();
  assert.equal(config["43114"].dex?.blackhole.adapter, blackholeAdapter);
  assert.deepEqual(
    config["43114"].partnerAdapters?.map((item) => item.adapter),
    [oldBlackholeAdapter],
  );
});

test("available identity sources survive a failed current config or one order service", async (t) => {
  t.mock.method(axios, "get", async (url: string) => {
    if (url !== `${SINK_API_URLS.prod}/status`) throw new Error("offline");
    return { data: statusCatalog() };
  });
  const config = await getSpotConfig();
  assert.equal(config["43114"].partnerAdapters?.[0].partnerName, "Blackhole");
  assert.equal(config["43114"].dex, undefined);
});

test("current config survives unavailable or malformed identity catalogs", async (t) => {
  t.mock.method(axios, "get", async (url: string) => {
    if (url === SPOT_CONFIG_URL) return { data: configuredSpot() };
    if (url.startsWith(CURRENT_SINK_API_URL)) return { data: { chains: [] } };
    throw new Error("offline");
  });
  const config = await getSpotConfig();
  assert.equal(config["43114"].dex?.blackhole.adapter, blackholeAdapter);
  assert.equal(config["43114"].partnerAdapters, undefined);
});

test("total configuration outage and wholly malformed sources remain errors", async (t) => {
  t.mock.method(axios, "get", async () => {
    throw new Error("offline");
  });
  await assert.rejects(getSpotConfig(), /offline/);
  t.mock.restoreAll();
  t.mock.method(axios, "get", async () => ({
    data: { chains: [{ chainId: "43114", exchanges: [] }] },
  }));
  await assert.rejects(getSpotConfig(), /Invalid Spot configuration/);
});

test("configuration cancellation is never converted to a partial successful catalog", async (t) => {
  const before = new AbortController();
  before.abort(new Error("cancelled before loading"));
  await assert.rejects(
    getSpotConfig(before.signal),
    /cancelled before loading/,
  );
  const during = new AbortController();
  t.mock.method(
    axios,
    "get",
    async (url: string, options: { signal: AbortSignal }) => {
      assert.equal(options.signal, during.signal);
      if (url !== SPOT_CONFIG_URL)
        during.abort(new Error("cancelled during loading"));
      return {
        data: url === SPOT_CONFIG_URL ? configuredSpot() : statusCatalog(),
      };
    },
  );
  await assert.rejects(
    getSpotConfig(during.signal),
    /cancelled during loading/,
  );
});
