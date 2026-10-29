import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  createElement,
  Fragment,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { spotOverviewOrdersQueryOptions } from "../apps/ops/src/lib/spot-overview-queries";
import { historyExchangeForPartners } from "../apps/ops/src/lib/spot-history-scope";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import { buildSpotOverview } from "../apps/ops/src/lib/overview-data";
import { buildActiveOrderAttention } from "../apps/ops/src/lib/attention-queue";
import { operationalNavigationScope } from "../apps/ops/src/lib/operational-scope";
import { useOperationalScope } from "../apps/ops/src/hooks/use-operational-scope";
import type { useOrderScope } from "../apps/ops/src/hooks/use-order-scope";
import type { useSpotOverview } from "../apps/ops/src/hooks/use-spot-overview";
import {
  investigateOrders,
  orderDetailHref,
  ordersScopeHref,
} from "../apps/ops/src/lib/order-investigation";
import { readInvestigationFilters } from "../apps/ops/src/lib/investigation-filter-query";

const snapshot = Date.parse("2026-10-22T12:00:00Z");
const day = 86_400_000;
const config = {
  "137": {
    dex: { quickswap: { adapter: "quick" }, sushiswap: { adapter: "sushi" } },
  },
  "1": { dex: { quickswap: { adapter: "ethereum-quick" } } },
} as unknown as SpotConfig;
const order = (
  hash: string,
  age: number,
  adapter = "quick",
  chainId = 137,
  status = "pending",
): ListOrder =>
  ({
    hash,
    source: "v2",
    exchangeAdapter: adapter,
    inputToken: "in",
    outputToken: "out",
    timestamp: new Date(snapshot - age * day).toISOString(),
    totalUSDAmount: "10",
    order: { witness: { chainId, deadline: String((snapshot - 1) / 1000) } },
    metadata: { status, chunkSummary: { lastChunkStatus: "error", error: 1 } },
  }) as ListOrder;
const records = [
  order("old-active", 30),
  order("recent-active", 1),
  order("old-ended", 30, "quick", 137, "failed"),
  order("other-app", 30, "sushi"),
  order("other-network", 30, "ethereum-quick", 1),
];
const selected = {
  period: "7",
  days: 7,
  chainIds: ["137"],
  partnerIds: ["quickswap"],
  key: "7:137:quickswap",
  query:
    "period=7&chain_id=137&partner_id=quickswap&order_status=failed&order_since=2026-10-21T00:00:00Z",
} as ReturnType<typeof useOrderScope>;
const reporting = buildSpotOverview({
  allOrders: records,
  config,
  updatedAt: snapshot,
  ...selected,
});
const data = {
  ...reporting,
  allOrders: records,
  config,
  updatedAt: snapshot,
} as ReturnType<typeof useSpotOverview>;
const requireOps = createRequire(resolve("apps/ops/package.json"));

function captureOperational(search = "", seedAllDates = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  if (seedAllDates)
    client.setQueryData(
      spotOverviewOrdersQueryOptions({
        chainIds: selected.chainIds,
        exchange: historyExchangeForPartners(
          config,
          selected.partnerIds,
          selected.chainIds,
        ),
      }).queryKey,
      records,
      { updatedAt: snapshot },
    );
  const updates: string[] = [];
  const adapter = {
    location: { search },
    push: (next: { search?: string }) => updates.push(next.search ?? ""),
    replace: (next: { search?: string }) => updates.push(next.search ?? ""),
  };
  function Adapter({
    children,
  }: {
    children: (value: typeof adapter) => ReactNode;
  }) {
    return createElement(Fragment, null, children(adapter));
  }
  const { QueryParamProvider } = requireOps("use-query-params") as {
    QueryParamProvider: ComponentType<{
      adapter: typeof Adapter;
      children?: ReactNode;
    }>;
  };
  let captured: ReturnType<typeof useOperationalScope> | undefined;
  function Capture() {
    captured = useOperationalScope(data, selected);
    return null;
  }
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        QueryParamProvider,
        { adapter: Adapter },
        createElement(Capture),
      ),
    ),
  );
  assert.ok(captured);
  client.clear();
  return { operational: captured, updates };
}

test("current operations include a 30-day-old active order independently of the reporting placement period", () => {
  const { operational } = captureOperational("?period=7&active_scope=all");
  assert.equal(operational.placement, "all");
  assert.deepEqual(operational.counts, { total: 2, shown: 2, excluded: 0 });
  assert.equal(operational.scope.period, "all");
  assert.equal(operational.scope.days, undefined);
  assert.ok(operational.data.orders.some((item) => item.hash === "old-active"));
  assert.deepEqual(
    reporting.orders.map((item) => item.hash),
    ["recent-active"],
    "the business reporting cohort stays unchanged",
  );
  assert.ok(
    operational.data.orders.every((item) => !item.hash.startsWith("other-")),
    "app and network scope still apply",
  );
});

test("placement narrowing is explicit, counts exclusions, and preserves the narrowed drilldown", () => {
  const { operational, updates } = captureOperational(
    "?period=7&active_scope=placement",
  );
  assert.deepEqual(operational.counts, { total: 2, shown: 1, excluded: 1 });
  assert.deepEqual(
    operational.data.orders.map((item) => item.hash),
    ["recent-active"],
  );
  assert.equal(operational.scope.period, "7");
  operational.setPlacement("all");
  assert.equal(new URLSearchParams(updates[0]).get("active_scope"), "all");
  assert.equal(
    new URLSearchParams(updates[0]).get("period"),
    "7",
    "switching operational scope does not edit the reporting period",
  );
});

test("global and partner active checks use the same rules and every all-history link reproduces the active cohort", () => {
  const { operational } = captureOperational("?active_scope=all");
  const issues = buildActiveOrderAttention(
    operational.data.orders,
    snapshot,
    operational.scope,
  );
  assert.deepEqual(
    issues.map((issue) => [issue.id, issue.count]),
    [
      ["overdue", 2],
      ["active-errors", 2],
    ],
  );
  assert.equal(
    new Set(issues.flatMap((issue) => issue.orders)).size,
    2,
    "overlapping signals deduplicate to unique orders",
  );
  for (const issue of issues) {
    const url = new URL(issue.href, "https://ops.test");
    assert.equal(url.searchParams.get("period"), "all");
    assert.deepEqual(url.searchParams.getAll("partner_id"), ["quickswap"]);
    assert.deepEqual(url.searchParams.getAll("chain_id"), ["137"]);
    assert.equal(
      url.searchParams.has("order_since"),
      false,
      "unrelated absolute bounds cannot hide old active orders",
    );
    const filters = readInvestigationFilters(
      Object.fromEntries(url.searchParams),
    );
    assert.deepEqual(
      investigateOrders(operational.data.orders, filters, undefined, snapshot)
        .map((item) => item.hash)
        .sort(),
      issue.orders.map((item) => item.hash).sort(),
    );
    const detail = new URL(
      orderDetailHref("old-active", "v2", {
        ...operational.scope,
        query: url.searchParams.toString(),
      }),
      "https://ops.test",
    );
    assert.equal(detail.searchParams.get("period"), "all");
    assert.equal(detail.searchParams.get("order_status"), "active");
  }
});

test("default and invalid operational scopes follow the selected period without requiring all-date history", () => {
  const { operational } = captureOperational("", false);
  assert.equal(operational.placement, "placement");
  assert.equal(operational.hasAllDatesCount, false);
  assert.deepEqual(
    operational.data.orders.map((item) => item.hash),
    ["recent-active"],
  );
  assert.equal(
    captureOperational("?active_scope=invalid").operational.placement,
    "placement",
  );
  const href = ordersScopeHref(operationalNavigationScope(selected));
  const query = new URL(href, "https://ops.test").searchParams;
  assert.equal(query.get("period"), "all");
  assert.equal(query.has("order_status"), false);
  assert.equal(query.has("order_since"), false);
});
