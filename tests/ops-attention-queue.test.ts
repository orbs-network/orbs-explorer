import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import type { PartnerCard } from "../packages/domain/src/twap/utils/orders-overview";
import {
  attentionOrdersHref,
  buildOrderAttention,
} from "../apps/ops/src/lib/attention-queue";
import { DEFAULT_MONITORING_RULES } from "../apps/ops/src/lib/overview-monitoring";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  getPlacementRangeError,
  investigateOrders,
  orderDetailHref,
} from "../apps/ops/src/lib/order-investigation";
import {
  investigationFilterQuery,
  readInvestigationFilters,
} from "../apps/ops/src/lib/investigation-filter-query";

const snapshot = Date.parse("2026-10-22T12:00:00Z");
const hour = 3_600_000;
const scope = {
  period: "7",
  chainIds: ["137", "0"],
  partnerIds: ["quickswap"],
  query:
    "orders_view=lookup&order_search=stale&order_errors=none&order_active_age=24h",
};
const order = (
  hash: string,
  status: string,
  deadline?: number,
  lastChunkStatus = "success",
  age = hour,
): ListOrder =>
  ({
    hash,
    source: "v2",
    exchangeAdapter: "adapter",
    timestamp: new Date(snapshot - age).toISOString(),
    inputToken: "in",
    outputToken: "out",
    totalUSDAmount: "10",
    order: {
      witness: {
        chainId: 137,
        deadline: deadline === undefined ? undefined : String(deadline / 1000),
      },
    },
    metadata: {
      status,
      chunkSummary: {
        lastChunkStatus,
        error: lastChunkStatus === "error" ? 1 : 0,
      },
    },
  }) as ListOrder;
const filters = (query: string) =>
  readInvestigationFilters(
    Object.fromEntries(new URL(query, "https://ops.test").searchParams),
  );
const hashes = (orders: ListOrder[]) =>
  orders.map((order) => order.hash).sort();

test("deadline cohorts match active states and exact snapshot boundaries; invalid deadlines remain unknown", () => {
  const records = [
    order("past", "pending", snapshot - 1),
    order("at", "eligible", snapshot),
    order("soon", "pending", snapshot + hour),
    order("later", "pending", snapshot + hour + 1),
    order("missing", "pending"),
    order("failed", "failed", snapshot - 1),
  ];
  for (const [deadline, expected] of [
    ["past", ["at", "past"]],
    ["soon", ["soon"]],
    ["unreported", ["missing"]],
  ] as const)
    assert.deepEqual(
      hashes(
        investigateOrders(
          records,
          { ...DEFAULT_INVESTIGATION_FILTERS, deadline },
          undefined,
          snapshot,
        ),
      ),
      expected,
    );
  assert.deepEqual(
    investigateOrders(
      records,
      { ...DEFAULT_INVESTIGATION_FILTERS, deadline: "past" },
      undefined,
      NaN,
    ),
    [],
  );
});

test("fixed placement bounds include boundaries and reject malformed, impossible and reversed ranges", () => {
  const since = new Date(snapshot - hour).toISOString();
  const until = new Date(snapshot).toISOString();
  const records = [
    order("before", "failed", undefined, "success", hour + 1),
    order("start", "failed"),
    order("end", "failed", undefined, "success", 0),
    order("future", "failed", undefined, "success", -1),
  ];
  assert.deepEqual(
    hashes(
      investigateOrders(records, {
        ...DEFAULT_INVESTIGATION_FILTERS,
        placedSince: since,
        placedUntil: until,
      }),
    ),
    ["end", "start"],
  );
  for (const value of [
    "bad",
    "2026-02-30T12:00:00Z",
    "2026-10-22T24:00:00Z",
    "2026-10-22T12:00:00+00:00",
  ])
    assert.ok(getPlacementRangeError(value, ""));
  assert.ok(getPlacementRangeError(until, since));
});

test("attention links retain repeated global scope, reset hidden facets and survive detail return", () => {
  const href = attentionOrdersHref(scope, {
    order_status: "active",
    order_deadline: "past",
  });
  const url = new URL(href, "https://ops.test");
  assert.deepEqual(url.searchParams.getAll("chain_id"), ["137", "0"]);
  assert.deepEqual(url.searchParams.getAll("partner_id"), ["quickswap"]);
  assert.equal(url.searchParams.get("period"), "7");
  for (const key of [
    "orders_view",
    "order_search",
    "order_errors",
    "order_active_age",
  ])
    assert.equal(url.searchParams.has(key), false);
  const value = filters(href);
  assert.deepEqual(
    readInvestigationFilters(investigationFilterQuery(value)),
    value,
  );
  const detail = new URL(
    orderDetailHref("hash", "v2", {
      ...scope,
      query: url.searchParams.toString(),
    }),
    "https://ops.test",
  );
  assert.equal(detail.searchParams.get("order_deadline"), "past");
});

test("attention queue separates current active errors from completed or terminal outcomes and every order link matches its cohort", () => {
  const records = [
    order("active-error", "pending", snapshot + hour, "error"),
    order("overdue", "pending", snapshot - 1),
    order("unknown", "pending"),
    order("completed-error", "completed", snapshot - 1, "error"),
    order("terminal", "failed", snapshot - 1, "error"),
  ];
  const cards = [
    {
      partnerId: "quickswap",
      partnerName: "QuickSwap",
      chains: [{ chainId: 137, orders: records }],
    },
  ] as PartnerCard[];
  const data = buildOrderAttention(
    {
      orders: records,
      partnerCards: cards,
      snapshot,
      rules: { ...DEFAULT_MONITORING_RULES, minimumOrders: 1 },
    },
    scope,
  );
  assert.deepEqual(
    hashes(data.issues.find((issue) => issue.id === "active-errors")!.orders),
    ["active-error"],
  );
  assert.deepEqual(
    hashes(data.issues.find((issue) => issue.id === "overdue")!.orders),
    ["overdue"],
  );
  assert.equal(
    data.issues.find((issue) => issue.id === "deadline-coverage")?.severity,
    "unknown",
  );
  const rate = new URL(
    data.issues.find((issue) => issue.id.startsWith("rate-"))!.href,
    "https://ops.test",
  );
  assert.equal(
    rate.searchParams.get("period"),
    "all",
    "absolute placement bounds must not drift with a rolling global period",
  );
  assert.equal(
    rate.searchParams.get("order_until"),
    new Date(snapshot).toISOString(),
  );
  for (const issue of data.issues.filter((issue) => !issue.unit))
    assert.deepEqual(
      hashes(
        investigateOrders(records, filters(issue.href), undefined, snapshot),
      ),
      hashes(issue.orders),
      issue.id,
    );
});
