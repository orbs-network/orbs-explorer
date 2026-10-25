import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSpotOverview } from "../apps/ops/src/lib/overview-data";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import {
  PARTNER_TABS,
  PARTNER_VIEWS,
  getPartnerView,
  legacyPartnerOrdersHref,
  globalScopeHref,
  partnerHref,
  partnerOrdersHref,
  partnerScopeSearch,
  resolvePartnerId,
} from "../apps/ops/src/lib/partner-navigation";

test("three partner tabs expose only distinct browsing views", () => {
  assert.deepEqual(
    PARTNER_TABS.map((tab) => tab.value),
    ["overview", "orders", "markets"],
  );
  const views = PARTNER_TABS.flatMap((tab) => [...tab.views]);
  const visible = PARTNER_VIEWS;
  assert.equal(views.length, visible.length);
  assert.equal(new Set(views).size, views.length);
  assert.deepEqual(new Set(views), new Set(visible.map((view) => view.value)));
  assert.equal(PARTNER_TABS[0].views[0], "overview");
  for (const tab of PARTNER_TABS) {
    for (const view of tab.views) {
      const url = new URL(
        partnerHref("sushiswap", "period=30&chain_id=42161", view),
        "https://ops.example",
      );
      assert.equal(getPartnerView(url.searchParams.get("view")), view);
      assert.equal(url.searchParams.get("period"), "30");
      assert.equal(url.searchParams.get("chain_id"), "42161");
    }
  }
});

test("partner IDs resolve registered aliases without changing configured custom IDs", () => {
  assert.equal(resolvePartnerId(" QUICK "), "quickswap");
  assert.equal(resolvePartnerId("Pancake"), "pancakeswap");
  assert.equal(resolvePartnerId("TEAFI"), "teaFi");
  assert.equal(resolvePartnerId("adapter-0xAbC123"), "adapter-0xabc123");
  assert.equal(resolvePartnerId(" CustomDex "), "CustomDex");
});

test("partner href keeps repeated global networks and forces the route partner", () => {
  const href = partnerHref(
    "quick",
    "?period=all&chain_id=137&chain_id=42161&partner_id=lynex&partner_id=thena&show_inactive_partners=1&source=v1&search=hash&view=failures",
  );
  const url = new URL(href, "https://ops.example");
  assert.equal(url.pathname, "/partners/quickswap");
  assert.deepEqual(
    [...url.searchParams.entries()],
    [
      ["period", "all"],
      ["chain_id", "137"],
      ["chain_id", "42161"],
      ["partner_id", "quickswap"],
    ],
  );
});

test("network filters normalize integers and discard duplicates and malformed IDs", () => {
  const params = partnerScopeSearch(
    "teaFi",
    "period=30&chain_id=000137&chain_id=137&chain_id=42161&chain_id=-1&chain_id=0&chain_id=1.5&chain_id=1e3&chain_id=0x89&chain_id=Infinity&chain_id=9007199254740992&chain_id=invalid",
  );
  assert.deepEqual(params.getAll("chain_id"), ["137", "42161", "0"]);
  assert.equal(params.get("partner_id"), "teaFi");
  assert.equal(params.get("period"), "30");
});

test("card-local networks override the global selection including an explicit empty selection", () => {
  const search = new URLSearchParams("period=7&chain_id=1&chain_id=10");
  const local = partnerHref("spark", search, "markets", [" 43114 ", "43114"]);
  const url = new URL(local, "https://ops.example");
  assert.deepEqual(url.searchParams.getAll("chain_id"), ["43114"]);
  assert.equal(url.searchParams.get("view"), "routes");
  assert.equal(url.searchParams.get("partner_id"), "sparkdex");
  assert.deepEqual(
    partnerScopeSearch("spark", search, []).getAll("chain_id"),
    [],
  );
  assert.deepEqual(search.getAll("chain_id"), ["1", "10"]);
});

test("partner Orders links preserve the displayed scope and replace hidden list facets", () => {
  const search =
    "period=30&chain_id=137&chain_id=1&partner_id=thena&order_status=completed&order_errors=none&order_search=hidden&min_usd=1000&order_raw=1&view=failures";
  const href = partnerOrdersHref("QUICK", search, {
    status: "active",
    errors: "latest",
  });
  const url = new URL(href, "https://ops.example");
  assert.equal(url.pathname, "/orders");
  assert.deepEqual(
    [...url.searchParams.entries()],
    [
      ["period", "30"],
      ["chain_id", "137"],
      ["chain_id", "1"],
      ["partner_id", "quickswap"],
      ["order_status", "active"],
      ["order_errors", "latest"],
    ],
  );
  const network = new URL(
    partnerOrdersHref("QUICK", search, { status: "failed" }, ["0"]),
    "https://ops.example",
  );
  assert.deepEqual(network.searchParams.getAll("chain_id"), ["0"]);
  assert.equal(network.searchParams.get("order_status"), "failed");
  assert.equal(network.searchParams.has("order_errors"), false);
  assert.deepEqual(
    new URL(
      partnerOrdersHref("quick", search),
      "https://ops.example",
    ).searchParams.getAll("partner_id"),
    ["quickswap"],
  );
});

test("partner overdue links match only the canonical active deadline cohort", () => {
  const url = new URL(
    partnerOrdersHref("sushiswap", "period=7&chain_id=42161", {
      status: "active",
      deadline: "past",
    }),
    "https://ops.example",
  );
  assert.equal(url.searchParams.get("order_status"), "active");
  assert.equal(url.searchParams.get("order_deadline"), "past");
  assert.deepEqual(url.searchParams.getAll("chain_id"), ["42161"]);
  assert.deepEqual(url.searchParams.getAll("partner_id"), ["sushiswap"]);
});

test("invalid period and view values use the existing overview and seven-day defaults", () => {
  assert.equal(getPartnerView("unknown"), "overview");
  assert.equal(getPartnerView("HEALTH"), "overview");
  assert.equal(getPartnerView(null), "overview");
  assert.equal(getPartnerView("orders"), "orders");
  assert.equal(getPartnerView("charts"), "overview");
  assert.equal(getPartnerView("markets"), "routes");
  assert.equal(partnerScopeSearch("lynex", "period=365").has("period"), false);
  assert.equal(
    partnerHref("lynex", "view=health&unrelated=value"),
    "/partners/lynex?partner_id=lynex",
  );
});

test("focused partner views keep the same partner, period and network filters", () => {
  for (const view of ["routes", "tokens"] as const) {
    const url = new URL(
      partnerHref(
        "quick",
        "period=30&chain_id=137&chain_id=1&partner_id=thena",
        view,
      ),
      "https://ops.example",
    );
    assert.equal(url.pathname, "/partners/quickswap");
    assert.equal(getPartnerView(url.searchParams.get("view")), view);
    assert.equal(url.searchParams.get("period"), "30");
    assert.deepEqual(url.searchParams.getAll("chain_id"), ["137", "1"]);
    assert.deepEqual(url.searchParams.getAll("partner_id"), ["quickswap"]);
  }
});

test("unknown adapter IDs and configured custom IDs produce local encoded links", () => {
  assert.equal(
    partnerHref("ADAPTER-0xAbC", "period=30", "failures"),
    "/partners/adapter-0xabc?period=30&partner_id=adapter-0xabc&view=orders&order_status=failed",
  );
  const custom = "Custom / Dex?view=health#section";
  const url = new URL(partnerHref(custom, ""), "https://ops.example");
  assert.equal(url.origin, "https://ops.example");
  assert.equal(
    decodeURIComponent(url.pathname.slice("/partners/".length)),
    custom,
  );
  assert.equal(url.searchParams.get("partner_id"), custom);
  assert.equal(url.searchParams.has("view"), false);
  assert.equal(url.hash, "");
});

test("global navigation carries only canonical global scope and honors route ownership", () => {
  const search =
    "period=30&chain_id=137&chain_id=43114&partner_id=quick&partner_id=quickswap&partner_id=thena&view=orders&source=v2&show_inactive_partners=1";
  assert.equal(
    globalScopeHref("/health", search),
    "/health?period=30&chain_id=137&chain_id=43114&partner_id=quickswap&partner_id=thena",
  );
  assert.equal(
    globalScopeHref("/orders/0x123", search, "TEAFI"),
    "/orders/0x123?period=30&chain_id=137&chain_id=43114&partner_id=teaFi",
  );
  assert.equal(globalScopeHref("/", "invalid=ignored"), "/");
});

test("global navigation refuses external URLs and ambiguous local paths", () => {
  for (const path of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/health?view=orders",
    "/health#section",
    "/\nexample.com",
  ]) {
    assert.throws(() => globalScopeHref(path, ""), TypeError);
  }
});

const snapshot = Date.parse("2026-10-21T12:00:00Z");
const config = {
  "137": {
    dex: {
      quick: { adapter: "quick-adapter" },
      thena: { adapter: "thena-adapter" },
      CustomDex: { adapter: "custom-adapter" },
    },
  },
  "1": { dex: { quickswap: { adapter: "quick-ethereum" } } },
} as unknown as SpotConfig;

function order(
  hash: string,
  adapter: string,
  chainId = 137,
  timestamp = "2026-10-21T10:00:00Z",
): ListOrder {
  return {
    hash,
    exchangeAdapter: adapter,
    inputToken: "0xaaa",
    outputToken: "0xbbb",
    totalUSDAmount: "10",
    timestamp,
    metadata: { status: "completed", displayOnlyStatus: "SUCCEEDED" },
    order: { witness: { chainId } },
  } as ListOrder;
}

test("partner scope isolates orders, cards and aggregates from conflicting URL partners", () => {
  const scope = partnerScopeSearch(
    "QUICK",
    "period=30&chain_id=137&partner_id=thena&partner_id=CustomDex",
  );
  const view = buildSpotOverview({
    allOrders: [
      order("quick-polygon", "quick-adapter"),
      order("quick-ethereum", "quick-ethereum", 1),
      order("thena", "thena-adapter"),
      order("custom", "custom-adapter"),
      order("unknown", "unconfigured-adapter"),
    ],
    config,
    updatedAt: snapshot,
    days: 30,
    chainIds: scope.getAll("chain_id"),
    partnerIds: scope.getAll("partner_id"),
  });
  assert.deepEqual(
    view.orders.map((item) => item.hash),
    ["quick-polygon"],
  );
  assert.deepEqual(
    view.partnerCards.map((card) => card.partnerId),
    ["quickswap"],
  );
  assert.deepEqual(
    view.networkActivity.map((chain) => chain.chainId),
    [137],
  );
  assert.equal(
    view.stats.reduce((sum, stat) => sum + stat.totalOrders, 0),
    1,
  );
  assert.equal(
    view.stats.reduce((sum, stat) => sum + stat.totalUsd, 0),
    10,
  );
});

test("configured custom partners retain their own identity and empty-period card", () => {
  const scope = partnerScopeSearch("CustomDex", "partner_id=quickswap");
  const view = buildSpotOverview({
    allOrders: [
      order("old-custom", "custom-adapter", 137, "2026-09-01T10:00:00Z"),
      order("recent-quick", "quick-adapter"),
    ],
    config,
    updatedAt: snapshot,
    days: 7,
    partnerIds: scope.getAll("partner_id"),
  });
  assert.deepEqual(view.orders, []);
  assert.deepEqual(
    view.partnerCards.map((card) => card.partnerId),
    ["CustomDex"],
  );
  assert.equal(view.partnerCards[0].chains[0].stats.totalOrders, 0);
  assert.equal(view.partnerCards[0].chains[0].stats.totalUsd, 0);
});

test("historical unknown adapters resolve independently of current period activity", () => {
  const scope = partnerScopeSearch(
    "ADAPTER-Unconfigured-Adapter",
    "partner_id=quickswap&period=7",
  );
  const allOrders = [
    order("old-unknown", "UNCONFIGURED-ADAPTER", 137, "2026-09-01T10:00:00Z"),
    order("recent-quick", "quick-adapter"),
  ];
  const input = {
    allOrders,
    config,
    updatedAt: snapshot,
    partnerIds: scope.getAll("partner_id"),
  };
  const current = buildSpotOverview({ ...input, days: 7 });
  assert.deepEqual(current.orders, []);
  assert.ok(
    current.partnerOptions.some(
      (option) => option.value === "adapter-unconfigured-adapter",
    ),
  );
  assert.equal(
    current.partnerCards[0].partnerId,
    "adapter-unconfigured-adapter",
  );
  assert.equal(current.networkActivity[0].chainId, 137);
  assert.equal(current.networkActivity[0].orders.length, 0);
  const history = buildSpotOverview(input);
  assert.deepEqual(
    history.orders.map((item) => item.hash),
    ["old-unknown"],
  );
  assert.deepEqual(
    history.partnerCards.map((card) => card.partnerId),
    ["adapter-unconfigured-adapter"],
  );
  assert.equal(
    history.stats.reduce((sum, stat) => sum + stat.totalOrders, 0),
    1,
  );
});

test("the network-not-provided bucket survives partner navigation and isolates its orders", () => {
  const scope = partnerScopeSearch(
    "ADAPTER-unknown-adapter",
    "chain_id=0&chain_id=0",
  );
  assert.deepEqual(scope.getAll("chain_id"), ["0"]);
  const view = buildSpotOverview({
    allOrders: [
      order("known", "quick-adapter"),
      order("unattributed", "unknown-adapter", 0),
    ],
    config,
    updatedAt: snapshot,
    chainIds: scope.getAll("chain_id"),
    partnerIds: scope.getAll("partner_id"),
  });
  assert.deepEqual(
    view.orders.map((record) => record.hash),
    ["unattributed"],
  );
  assert.equal(
    new URL(
      partnerHref("quick", "chain_id=0"),
      "https://ops.example",
    ).searchParams.get("chain_id"),
    "0",
  );
});

test("old adapter links resolve to the named app using only matching networks", () => {
  const adapter = "0x426ec4bc0d58B80959CDE77576a1942dd40592Fa";
  const catalog = {
    "43114": {
      partnerAdapters: [
        { partnerId: "blackhole", partnerName: "Blackhole", adapter },
      ],
    },
  } as SpotConfig;
  assert.equal(
    resolvePartnerId(`ADAPTER-${adapter}`, catalog, ["43114"]),
    "blackhole",
  );
  assert.equal(
    resolvePartnerId(`adapter-${adapter}`, catalog, ["137"]),
    `adapter-${adapter.toLowerCase()}`,
  );
  assert.equal(resolvePartnerId(`adapter-${adapter}`, catalog), "blackhole");
});

test("retired partner execution links use Orders with explicit placement scope", () => {
  for (const view of ["health", "progress", "failures", "lookup"]) {
    const url = new URL(
      legacyPartnerOrdersHref("quick", `period=7&chain_id=137&view=${view}`)!,
      "https://ops.example",
    );
    assert.equal(url.pathname, "/partners/quickswap");
    assert.equal(url.searchParams.get("view"), "orders");
    assert.equal(url.searchParams.get("partner_id"), "quickswap");
    assert.equal(url.searchParams.get("chain_id"), "137");
    assert.equal(
      url.searchParams.get("period"),
      ["health", "progress"].includes(view) ? "all" : "7",
    );
    assert.equal(
      url.searchParams.get("order_status"),
      view === "failures" ? "failed" : view === "lookup" ? null : "active",
    );
  }
  const href = legacyPartnerOrdersHref(
    "quick",
    "view=progress&progress_scope=all&active_scope=placement&period=30",
  )!;
  const params = new URL(href, "https://ops.example").searchParams;
  assert.equal(params.get("period"), "30");
  assert.equal(params.has("order_status"), false);
  for (const view of ["activity", "outcomes", "networks", "charts"])
    assert.equal(getPartnerView(view), "overview");
  assert.equal(
    legacyPartnerOrdersHref("quick", "view=orders&order_status=failed"),
    undefined,
  );
});
