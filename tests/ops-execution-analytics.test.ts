import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import {
  buildExecutionHealth,
  buildFailureAnalytics,
  buildFailureImpact,
  deadlineTime,
} from "../apps/ops/src/lib/execution-analytics";

const snapshot = Date.parse("2026-10-20T12:00:00Z");
const HOUR = 3_600_000;
const DAY = HOUR * 24;
let sequence = 0;
function order({
  status = "pending",
  placed = snapshot - HOUR,
  deadline = snapshot + DAY,
  metadata = {},
}: {
  status?: string;
  placed?: number;
  deadline?: number;
  metadata?: Record<string, unknown>;
} = {}): ListOrder {
  return {
    hash: `order-${sequence++}`,
    source: "v2",
    timestamp: Number.isFinite(placed)
      ? new Date(placed).toISOString()
      : "invalid",
    totalUSDAmount: "10",
    metadata: { status, ...metadata },
    order: { witness: { chainId: 137, deadline: String(deadline / 1000) } },
  } as ListOrder;
}

test("active deadline bands are exhaustive and use non-overlapping snapshot boundaries", () => {
  const active = [
    order({ deadline: snapshot - 1 }),
    order({ deadline: snapshot }),
    order({ deadline: snapshot + 1 }),
    order({ deadline: snapshot + HOUR }),
    order({ deadline: snapshot + HOUR + 1 }),
    order({ deadline: snapshot + DAY }),
    order({ deadline: snapshot + DAY + 1 }),
    order({ deadline: NaN }),
  ];
  const completed = order({ status: "completed", deadline: snapshot - 1 });
  const data = buildExecutionHealth([...active, completed], snapshot);
  assert.equal(data.active.length, 8);
  assert.deepEqual(
    data.deadlines.map((band) => band.orders.length),
    [2, 2, 2, 1, 1],
  );
  assert.equal(
    data.deadlines.flatMap((band) => band.orders).length,
    data.active.length,
  );
  assert.equal(data.activeValue, 80);
  assert.equal(data.attention.includes(completed), false);
});

test("active age bands use placement time and keep future or missing placement unavailable", () => {
  const active = [
    order({ placed: snapshot }),
    order({ placed: snapshot - HOUR }),
    order({ placed: snapshot - 6 * HOUR }),
    order({ placed: snapshot - DAY }),
    order({ placed: snapshot - 7 * DAY }),
    order({ placed: NaN }),
    order({ placed: snapshot + 1 }),
  ];
  const data = buildExecutionHealth(active, snapshot);
  assert.deepEqual(
    data.ages.map((band) => band.orders.length),
    [1, 1, 1, 1, 1, 2],
  );
  assert.deepEqual(data.oldOrders, active.slice(3, 5));
});

test("waiting states honor explicit price-check display before raw eligibility", () => {
  const priceCheck = order({
    status: "eligible",
    metadata: { displayOnlyStatus: "PENDING-PRICE-CHECK" },
  });
  const eligible = order({ status: "eligible" });
  const pending = order();
  const completed = order({
    status: "completed",
    metadata: { displayOnlyStatus: "PENDING-PRICE-CHECK" },
  });
  const data = buildExecutionHealth(
    [priceCheck, eligible, pending, completed],
    snapshot,
  );
  assert.deepEqual(
    data.signals.map((signal) => signal.orders),
    [[priceCheck], [eligible], [pending]],
  );
});

test("chunk summaries preserve missing coverage and clamp remaining planned chunks", () => {
  const started = order({
    metadata: { expectedChunks: 4, chunkSummary: { success: 2, error: 3 } },
  });
  const zero = order({
    metadata: { expectedChunks: 0, chunkSummary: { success: 0, error: 0 } },
  });
  const over = order({
    metadata: { expectedChunks: 1, chunkSummary: { success: 2, error: -1 } },
  });
  const unavailable = order({
    metadata: {
      expectedChunks: "",
      chunkSummary: { success: "", error: null },
    },
  });
  const data = buildExecutionHealth(
    [started, zero, over, unavailable],
    snapshot,
  );
  assert.equal(data.successfulChunks, 4);
  assert.equal(data.successfulCoverage, 3);
  assert.equal(data.errorChunks, 3);
  assert.equal(data.errorCoverage, 2);
  assert.equal(data.remainingChunks, 2);
  assert.equal(data.remainingCoverage, 3);
  assert.deepEqual(data.withProgress, [started, over]);
  assert.deepEqual(data.noSuccess, [zero]);
  assert.deepEqual(data.progressUnavailable, [unavailable]);
});

test("active review queue shares current checks and keeps age, upcoming deadlines and recovered errors as context", () => {
  const past = order({
    placed: snapshot - 2 * DAY,
    deadline: snapshot - HOUR,
    metadata: { chunkSummary: { error: 1, lastChunkStatus: "error" } },
  });
  const near = order({ deadline: snapshot + HOUR });
  const errorHistory = order({
    metadata: { chunkSummary: { error: 1, lastChunkStatus: "success" } },
  });
  const normal = order({ deadline: snapshot + 2 * DAY });
  const oldConditional = order({
    placed: snapshot - 30 * DAY,
    deadline: snapshot + 28 * DAY,
  });
  const missingDeadline = order({ deadline: NaN });
  const data = buildExecutionHealth(
    [near, errorHistory, normal, past, oldConditional, missingDeadline],
    snapshot,
  );
  assert.equal(data.active.length, 6);
  assert.equal(data.attention.length, 2);
  assert.equal(data.attention[0], past);
  assert.deepEqual(data.attention, [past, missingDeadline]);
  assert.ok(data.oldOrders.includes(oldConditional));
  assert.ok(data.deadlines[1].orders.includes(near));
  assert.deepEqual(data.lastErrors, [past]);
  assert.deepEqual(data.activeWithErrors, [errorHistory, past]);
});

test("failure cohorts separate terminal outcome, latest attempt, active retries and completed history", () => {
  const activeError = order({
    metadata: {
      chunkSummary: {
        error: 2,
        lastChunkStatus: "error",
        lastChunkDescription: "Insufficient gas",
      },
    },
  });
  const completedHistory = order({
    status: "completed",
    metadata: {
      chunkSummary: {
        error: 1,
        lastChunkStatus: "success",
        lastChunkDescription: "Executed",
      },
    },
  });
  const terminal = order({
    status: "failed",
    metadata: { description: "Order rejected" },
  });
  const clean = order({
    status: "completed",
    metadata: { chunkSummary: { error: 0, lastChunkStatus: "success" } },
  });
  const data = buildFailureAnalytics([
    activeError,
    completedHistory,
    terminal,
    clean,
  ]);
  assert.deepEqual(data.cohorts.all, [activeError, completedHistory, terminal]);
  assert.deepEqual(data.cohorts.terminal, [terminal]);
  assert.deepEqual(data.cohorts.latest, [activeError]);
  assert.deepEqual(data.cohorts.active, [activeError]);
  assert.deepEqual(data.cohorts.completed, [completedHistory]);
  assert.equal(data.reportedErrors, 3);
  assert.equal(data.errorCoverage, 3);
  assert.equal(
    data.reasons.some((reason) => reason.reason === "Executed"),
    false,
  );
  assert.equal(
    data.reasons.some(
      (reason) =>
        reason.reason === "Earlier error reason unavailable in this summary",
    ),
    true,
  );
});

test("reason groups retain exact messages and use only valid placement times", () => {
  const a = order({
    status: "failed",
    metadata: { description: "Price error" },
  });
  const b = order({
    status: "failed",
    placed: NaN,
    metadata: { description: " Price error " },
  });
  const c = order({
    status: "failed",
    metadata: { description: "price error" },
  });
  const data = buildFailureAnalytics([a, b, c]);
  assert.equal(data.reasons.length, 2);
  assert.deepEqual(data.reasons[0].orders, [a, b]);
  assert.equal(data.reasons[0].latestPlaced, snapshot - HOUR);
  assert.equal(data.reasons[0].value, 20);
  assert.equal(data.reasons[0].terminal.length, 2);
});

test("failure impact preserves total cohort denominator and excludes unaffected groups", () => {
  const failed = order({ status: "failed" });
  const healthy = order({ status: "completed" });
  const rows = buildFailureImpact([
    { id: "a", label: "App A", orders: [failed, healthy] },
    { id: "b", label: "App B", orders: [healthy] },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orders.length, 2);
  assert.equal(rows[0].all.length, 1);
  assert.equal(rows[0].terminal.length, 1);
  assert.equal(rows[0].affectedValue, 10);
});

test("zero, invalid and out-of-range deadlines remain unavailable", () => {
  for (const deadline of [0, -1, NaN, Infinity, 8.64e15 + 1000]) {
    assert.equal(deadlineTime(order({ deadline })), undefined);
  }
  const missing = order();
  missing.order.witness.deadline = "";
  assert.equal(deadlineTime(missing), undefined);
  assert.equal(buildExecutionHealth([], snapshot).activeValue, 0);
  assert.deepEqual(buildFailureAnalytics([]).cohorts.all, []);
});

test("unreported USD stays distinct from reported zero in execution and failure coverage", () => {
  const missing = order();
  missing.totalUSDAmount = "";
  const zero = order({ status: "failed" });
  zero.totalUSDAmount = "0";
  assert.equal(
    buildExecutionHealth([missing], snapshot).activeValueCoverage,
    0,
  );
  assert.equal(buildFailureAnalytics([zero]).reasons[0].valueCoverage, 1);
  missing.metadata.status = "failed";
  const impact = buildFailureImpact([
    { id: "a", label: "App", orders: [zero, missing] },
  ])[0];
  assert.equal(impact.affectedValue, 0);
  assert.equal(impact.affectedValueCoverage, 1);
});
