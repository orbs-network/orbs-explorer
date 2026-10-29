import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder, Order } from "../packages/domain/src/twap/types";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  buildOrderSearchLabels,
  fullOrderToInspectionOrder,
  getUsdRangeError,
  getSwapperAddressError,
  investigateOrders,
  isOrderHash,
  orderDetailHref,
  ordersScopeHref,
  type InvestigationFilters,
} from "../apps/ops/src/lib/order-investigation";
import { orderIdentity } from "../apps/ops/src/lib/order-selection";

function order(hash: string, overrides: Partial<ListOrder> = {}): ListOrder {
  return {
    hash,
    source: "v2",
    exchangeAdapter: "0xAdapter",
    inputToken: "0xInput",
    outputToken: "0xOutput",
    timestamp: "2026-10-20T10:00:00Z",
    totalUSDAmount: "10",
    metadata: { status: "completed", orderType: "Limit" },
    order: { witness: { chainId: 137, deadline: "1800000000", epoch: 60 } },
    ...overrides,
  } as ListOrder;
}

const find = (orders: ListOrder[], filters: Partial<InvestigationFilters>) =>
  investigateOrders(orders, { ...DEFAULT_INVESTIGATION_FILTERS, ...filters });

test("swapper matching is exact, case insensitive, and never borrows another wallet's order", () => {
  const swapper = `0x${"ab".repeat(20)}`;
  const match = order("wallet-match", {
    order: { witness: { chainId: 137, swapper } } as ListOrder["order"],
  });
  const other = order("other-wallet", {
    order: {
      witness: { chainId: 137, swapper: `0x${"cd".repeat(20)}` },
    } as ListOrder["order"],
  });
  const missing = order("missing-wallet");
  assert.deepEqual(
    find([match, other, missing], {
      swapper: ` ${swapper.toUpperCase().replace("0X", "0x")} `,
    }),
    [match],
  );
  assert.deepEqual(
    find([match, other, missing], { swapper: swapper.slice(0, -1) }),
    [],
  );
  assert.ok(getSwapperAddressError("0x123"));
  assert.equal(getSwapperAddressError(""), undefined);
});

test("swapper service membership matches list rows by service, network, and hash while retaining other filters", () => {
  const swapper = `0x${"a".repeat(40)}`;
  const match = order("0xshared");
  const legacy = order("0xshared", { source: "v1" });
  const otherChain = order("0xshared", {
    order: { witness: { chainId: 1 } } as ListOrder["order"],
  });
  const filters = { ...DEFAULT_INVESTIGATION_FILTERS, swapper };
  const keys = new Set([orderIdentity(match)]);
  assert.deepEqual(
    investigateOrders(
      [match, legacy, otherChain],
      filters,
      undefined,
      Date.now(),
      keys,
    ),
    [match],
  );
  assert.deepEqual(
    investigateOrders(
      [match],
      { ...filters, status: "active" },
      undefined,
      Date.now(),
      keys,
    ),
    [],
  );
  assert.deepEqual(investigateOrders([match], filters), []);
  const url = new URL(
    orderDetailHref(match.hash, match.source, {
      query: `order_swapper=${swapper}&period=30`,
    }),
    "https://ops.example",
  );
  assert.equal(url.searchParams.get("order_swapper"), swapper);
  assert.equal(
    new URL(
      ordersScopeHref({ query: url.search }),
      "https://ops.example",
    ).searchParams.get("order_swapper"),
    swapper,
  );
});

test("investigation searches across fields and requires every query term", () => {
  const match = order("0xFirst", {
    metadata: {
      status: "pending",
      srcToken: { symbol: "USDC", name: "USD Coin" },
      dstToken: { symbol: "WETH" },
      chunkSummary: { lastChunkDescription: "INSUFFICIENT GAS" },
    } as ListOrder["metadata"],
  });
  const other = order("0xSecond");
  assert.deepEqual(find([match, other], { query: " usdc GAS V2 " }), [match]);
  assert.deepEqual(find([match, other], { query: "USD Coin 0xFirst" }), [
    match,
  ]);
  assert.equal(
    find([match, other], { query: "usdc missing-reason" }).length,
    0,
  );
  assert.deepEqual(find([match], { query: "0xadapter 137 active" }), [match]);
  assert.deepEqual(
    investigateOrders(
      [match],
      { ...DEFAULT_INVESTIGATION_FILTERS, query: "quickswap gas" },
      new Map([[match, "QuickSwap"]]),
    ),
    [match],
  );
});

test("investigation searches preloaded token metadata on the order's own network without mutating raw orders", () => {
  const polygon = order("polygon");
  const ethereum = order("ethereum", {
    order: { witness: { chainId: 1 } } as ListOrder["order"],
  });
  const duplicate = order("polygon-second");
  const lookups: string[] = [];
  const labels = buildOrderSearchLabels(
    [polygon, ethereum, duplicate],
    (address, chainId) => {
      lookups.push(`${chainId}:${address}`);
      if (address === "0xinput")
        return chainId === 137
          ? { symbol: "USDC", name: "USD Coin" }
          : { symbol: "DAI", name: "Dai Stablecoin" };
      return { symbol: "WBTC", name: "Wrapped Bitcoin" };
    },
    new Map([[polygon, "QuickSwap"]]),
  );
  const search = (query: string) =>
    investigateOrders(
      [polygon, ethereum, duplicate],
      { ...DEFAULT_INVESTIGATION_FILTERS, query },
      labels,
    );
  assert.deepEqual(search("USDC QuickSwap"), [polygon]);
  assert.deepEqual(search("Dai Stablecoin"), [ethereum]);
  assert.deepEqual(search("Wrapped Bitcoin 0xinput"), [
    ethereum,
    polygon,
    duplicate,
  ]);
  assert.equal(
    lookups.length,
    4,
    "resolve repeated chain/address references once",
  );
  assert.equal(polygon.metadata.srcToken, undefined);
  assert.equal(polygon.metadata.dstToken, undefined);
});

test("orders without a valid network keep partner labels without borrowing cached token names", () => {
  const unknown = order("unknown", {
    order: { witness: { chainId: 0 } } as ListOrder["order"],
  });
  const labels = buildOrderSearchLabels(
    [unknown],
    () => {
      assert.fail("Unknown networks must not resolve token metadata");
    },
    new Map([[unknown, "Unknown adapter"]]),
  );
  assert.deepEqual(
    investigateOrders(
      [unknown],
      {
        ...DEFAULT_INVESTIGATION_FILTERS,
        query: "unknown adapter",
      },
      labels,
    ),
    [unknown],
  );
  assert.deepEqual(
    investigateOrders(
      [unknown],
      {
        ...DEFAULT_INVESTIGATION_FILTERS,
        query: "USDC",
      },
      labels,
    ),
    [],
  );
});

test("status filters preserve active retries independently of terminal failure", () => {
  const retry = order("retry", {
    metadata: {
      status: "pending",
      displayOnlyStatus: "FAILED",
      chunkSummary: { error: 3, lastChunkStatus: "error" },
    } as ListOrder["metadata"],
  });
  const terminal = order("terminal", {
    metadata: { status: "failed" } as ListOrder["metadata"],
  });
  const recovered = order("recovered", {
    metadata: {
      status: "completed",
      chunkSummary: { error: 2, lastChunkStatus: "success" },
    } as ListOrder["metadata"],
  });
  const unknown = order("unknown", {
    metadata: { status: "new-service-state" } as ListOrder["metadata"],
  });
  const orders = [retry, terminal, recovered, unknown];
  assert.deepEqual(find(orders, { status: "active", errors: "any" }), [retry]);
  assert.deepEqual(find(orders, { status: "failed" }), [terminal]);
  assert.equal(find(orders, { status: "failed", errors: "any" }).length, 0);
  assert.deepEqual(find(orders, { errors: "latest" }), [retry]);
  assert.deepEqual(find(orders, { errors: "recovered" }), [recovered]);
  assert.deepEqual(find(orders, { status: "unknown" }), [unknown]);
});

test("zero reported errors excludes orders with missing counts or a latest failed chunk", () => {
  const clean = order("clean", {
    metadata: {
      status: "completed",
      chunkSummary: { error: 0, lastChunkStatus: "success" },
    } as ListOrder["metadata"],
  });
  const contradictory = order("contradictory", {
    metadata: {
      status: "pending",
      chunkSummary: { error: 0, lastChunkStatus: "failed" },
    } as ListOrder["metadata"],
  });
  const missing = order("missing");
  assert.deepEqual(find([clean, contradictory, missing], { errors: "none" }), [
    clean,
  ]);
  assert.deepEqual(
    find([clean, contradictory, missing], { errors: "unreported" }),
    [missing],
  );
  assert.deepEqual(find([clean, contradictory, missing], { errors: "any" }), [
    contradictory,
  ]);
});

test("order service and type filters combine and retain missing-field options", () => {
  const current = order("current");
  const original = order("original", { source: "v1" });
  const missing = order("missing", {
    source: undefined,
    metadata: { status: "cancelled" } as ListOrder["metadata"],
  });
  assert.deepEqual(
    find([current, original, missing], { source: "v1", type: "Limit" }),
    [original],
  );
  assert.deepEqual(
    find([current, original, missing], {
      source: "unreported",
      type: "unreported",
    }),
    [missing],
  );
  assert.equal(find([current], { type: "Market" }).length, 0);
});

test("technical address filters match exact fields and either token side without substring or cross-field matches", () => {
  const adapter = `0x${"a".repeat(40)}`;
  const token = `0x${"b".repeat(40)}`;
  const input = order("input", {
    exchangeAdapter: adapter,
    inputToken: token,
    metadata: {
      status: "pending",
      chunkSummary: { error: 2, lastChunkStatus: "error" },
    } as ListOrder["metadata"],
  });
  const output = order("output", {
    exchangeAdapter: adapter,
    outputToken: token,
    source: "v1",
  });
  const wrongFields = order(token, {
    exchangeAdapter: token,
    inputToken: adapter,
  });
  const longer = order("longer", {
    exchangeAdapter: `${adapter}f`,
    inputToken: `${token}f`,
  });
  const rows = [input, output, wrongFields, longer];
  assert.deepEqual(find(rows, { adapter: ` ${adapter.toUpperCase()} ` }), [
    input,
    output,
  ]);
  assert.deepEqual(find(rows, { token: ` ${token.toUpperCase()} ` }), [
    input,
    output,
  ]);
  assert.deepEqual(
    find(rows, {
      adapter,
      token,
      status: "active",
      source: "v2",
      errors: "latest",
    }),
    [input],
  );
  assert.deepEqual(find(rows, { adapter, token, source: "v1" }), [output]);
  assert.deepEqual(find(rows, { adapter: "0xa" }), []);
  assert.deepEqual(find(rows, { token: "0xb" }), []);
  assert.deepEqual(find(rows, { adapter, token: adapter }), []);
  assert.deepEqual(rows, [input, output, wrongFields, longer]);
});

test("technical filters keep malformed observed addresses queryable and treat unknown services as unreported", () => {
  const malformed = order("malformed", {
    exchangeAdapter: "broken-address",
    source: "future" as ListOrder["source"],
  });
  const missing = order("missing", {
    exchangeAdapter: undefined as unknown as string,
    inputToken: null as unknown as string,
    source: undefined,
  });
  assert.deepEqual(
    find([malformed, missing], {
      adapter: " BROKEN-ADDRESS ",
      source: "unreported",
    }),
    [malformed],
  );
  assert.deepEqual(find([malformed, missing], { source: "unreported" }), [
    malformed,
    missing,
  ]);
  assert.deepEqual(find([malformed, missing], { token: "0xinput" }), [
    malformed,
  ]);
  assert.deepEqual(find([malformed, missing], { source: "v1" }), []);
});

test("USD bounds retain valid zero, exclude unknown values, and reject malformed ranges", () => {
  const zero = order("zero", { totalUSDAmount: "0" });
  const ten = order("ten");
  const missing = order("missing", { totalUSDAmount: "" });
  const invalid = order("invalid", { totalUSDAmount: "NaN" });
  assert.deepEqual(
    find([zero, ten, missing, invalid], { minUsd: "0", maxUsd: "0" }),
    [zero],
  );
  assert.deepEqual(find([zero, ten, missing], { minUsd: "10", maxUsd: "10" }), [
    ten,
  ]);
  assert.equal(getUsdRangeError("", ""), undefined);
  for (const [minUsd, maxUsd] of [
    ["-1", ""],
    ["NaN", "10"],
    ["20", "10"],
    ["", "Infinity"],
  ]) {
    assert.ok(getUsdRangeError(minUsd, maxUsd));
    assert.deepEqual(find([ten], { minUsd, maxUsd }), []);
  }
});

test("sorting always places missing dates, values, and error counts after reported values", () => {
  const older = order("older", {
    timestamp: "2026-10-19T10:00:00Z",
    totalUSDAmount: "0",
    metadata: {
      status: "completed",
      chunkSummary: { error: 0 },
    } as ListOrder["metadata"],
  });
  const newer = order("newer", {
    metadata: {
      status: "pending",
      chunkSummary: { error: 4 },
    } as ListOrder["metadata"],
  });
  const missing = order("missing", {
    timestamp: "invalid",
    totalUSDAmount: "",
  });
  const orders = [missing, newer, older];
  assert.deepEqual(find(orders, { sort: "newest" }), [newer, older, missing]);
  assert.deepEqual(find(orders, { sort: "oldest" }), [older, newer, missing]);
  assert.deepEqual(find(orders, { sort: "value-asc" }), [
    older,
    newer,
    missing,
  ]);
  assert.deepEqual(find(orders, { sort: "value-desc" }), [
    newer,
    older,
    missing,
  ]);
  assert.deepEqual(find(orders, { sort: "errors-desc" }), [
    newer,
    older,
    missing,
  ]);
  assert.deepEqual(orders, [missing, newer, older]);
});

test("direct detail snapshots derive chunk counts and latest report without an overview lookup", () => {
  const full = {
    source: "v2",
    hash: `0x${"a".repeat(64)}`,
    timestamp: "2026-10-20T10:00:00Z",
    order: {
      witness: {
        chainid: 137,
        deadline: "1800000000",
        epoch: 60,
        exchange: { adapter: "0xAdapter" },
        input: { token: "0xInput" },
        output: { token: "0xOutput" },
      },
    },
    metadata: {
      status: "pending",
      chunks: [
        { index: 1, status: "success", timestamp: "2026-10-20T10:01:00Z" },
        {
          index: 2,
          status: "failed",
          timestamp: "2026-10-20T10:02:00Z",
          description: "Insufficient gas",
        },
        { index: 3, status: "pending", timestamp: "invalid" },
      ],
    },
  } as unknown as Order;
  const allServices = fullOrderToInspectionOrder(full);
  assert.equal(allServices.source, undefined);
  assert.equal(allServices.totalUSDAmount, "");
  assert.equal(allServices.order.witness.chainId, 137);
  assert.equal(allServices.metadata.chunkSummary.success, 1);
  assert.equal(allServices.metadata.chunkSummary.error, 1);
  assert.equal(allServices.metadata.chunkSummary.total, 3);
  assert.equal(allServices.metadata.chunkSummary.lastChunkStatus, "failed");
  assert.equal(
    allServices.metadata.chunkSummary.lastChunkDescription,
    "Insufficient gas",
  );
  assert.equal(fullOrderToInspectionOrder(full, "v2").source, "v2");
  assert.equal(full.metadata.chunks[0].index, 1);
  assert.equal(
    fullOrderToInspectionOrder({
      ...full,
      metadata: { ...full.metadata, chunks: [] },
    }).metadata.chunkSummary.total,
    0,
  );
});

test("direct lookup validates exact hashes and retains explicit source in shareable links", () => {
  const hash = `0x${"ab".repeat(32)}`;
  assert.equal(isOrderHash(` ${hash} `), true);
  for (const bad of [
    "",
    "0x123",
    `0x${"z".repeat(64)}`,
    hash.slice(2),
    `${hash}/other`,
  ])
    assert.equal(isOrderHash(bad), false);
  assert.equal(orderDetailHref(hash), `/orders/${hash}`);
  assert.equal(orderDetailHref(hash, "v1"), `/orders/${hash}?source=v1`);
  assert.equal(orderDetailHref("a/b", "v2"), "/orders/a%2Fb?source=v2");
});

test("order detail, source switching, and return links preserve the complete global scope", () => {
  const scope = {
    period: "all",
    chainIds: ["137", "42161"],
    partnerIds: ["quickswap", "app with spaces"],
  };
  const detail = new URL(
    orderDetailHref("0xabc", "v2", scope),
    "https://ops.example",
  );
  const returnLink = new URL(ordersScopeHref(scope), "https://ops.example");
  for (const url of [detail, returnLink]) {
    assert.equal(url.searchParams.get("period"), "all");
    assert.deepEqual(url.searchParams.getAll("chain_id"), ["137", "42161"]);
    assert.deepEqual(url.searchParams.getAll("partner_id"), [
      "quickswap",
      "app with spaces",
    ]);
  }
  assert.equal(detail.searchParams.get("source"), "v2");
  assert.equal(returnLink.searchParams.has("source"), false);
  assert.equal(ordersScopeHref(), "/orders");
});
