import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import {
  buildOrderDiagnostics,
  getFailureReason,
  hasExecutionErrors,
  reportedNumber,
} from "../apps/ops/src/lib/order-diagnostics";

const snapshot = Date.parse("2026-10-20T12:00:00Z");
function order(
  status: string,
  metadata: Record<string, unknown> = {},
  deadline = snapshot + 3_600_000,
): ListOrder {
  return {
    hash: status,
    source: "v2",
    totalUSDAmount: "10",
    timestamp: "2026-10-20T10:00:00Z",
    metadata: { status, ...metadata },
    order: { witness: { chainId: 137, deadline: String(deadline / 1000) } },
  } as ListOrder;
}

test("execution errors distinguish retries, recovered orders and terminal failures", () => {
  const retry = order("pending", {
    chunkSummary: {
      error: 2,
      success: 0,
      lastChunkStatus: "error",
      lastChunkDescription: "Insufficient gas",
    },
  });
  const recovered = order("completed", {
    chunkSummary: {
      error: 1,
      success: 1,
      lastChunkStatus: "success",
      lastChunkDescription: "Completed",
      lastChunkExtraError: true,
    },
  });
  const clean = order("completed", {
    chunkSummary: {
      error: 0,
      success: 1,
      lastChunkStatus: "success",
      lastChunkExtraError: true,
    },
  });
  const failure = order("failed", { description: "Order rejected" });
  const data = buildOrderDiagnostics(
    [retry, recovered, clean, failure],
    snapshot,
  );
  assert.deepEqual(data.withErrors, [retry, recovered]);
  assert.deepEqual(data.activeWithErrors, [retry]);
  assert.equal(data.errorChunks, 3);
  assert.equal(data.successfulChunks, 2);
  assert.equal(data.errorCoverage, 3);
  assert.equal(data.lastErrors.length, 1);
  assert.deepEqual(data.reasons.map((r) => r.reason).sort(), [
    "Insufficient gas",
    "Order rejected",
  ]);
  assert.equal(getFailureReason(recovered), undefined);
  assert.equal(hasExecutionErrors(clean), false);
});

test("missing or invalid reported fields stay unknown and do not inflate averages", () => {
  for (const value of [null, undefined, "", " ", "NaN", Infinity, -1, true, {}])
    assert.equal(reportedNumber(value), undefined);
  assert.equal(reportedNumber("0"), 0);
  const missing = order("pending");
  missing.totalUSDAmount = "";
  missing.timestamp = "invalid";
  const data = buildOrderDiagnostics([missing, order("completed")], snapshot);
  assert.equal(data.averageValue, 10);
  assert.equal(data.largestValue, 10);
  assert.equal(data.pricedOrders, 1);
  assert.equal(data.expectedCoverage, 0);
  assert.equal(data.successfulCoverage, 0);
  assert.equal(data.recentOrders, 1);
  assert.equal(data.firstPlaced, Date.parse("2026-10-20T10:00:00Z"));
  assert.equal(buildOrderDiagnostics([], snapshot).averageValue, undefined);
});

test("deadline diagnostics only count currently active orders and respect the snapshot", () => {
  const data = buildOrderDiagnostics(
    [
      order("pending"),
      order("eligible", {}, snapshot - 1000),
      order("completed", {}, snapshot - 1000),
      order("expired", {}, snapshot - 1000),
      order("pending", {}, snapshot + 2 * 86_400_000),
      order("pending", {}, NaN),
    ],
    snapshot,
  );
  assert.equal(data.expiring, 1);
  assert.equal(data.overdue, 1);
});

test("types, sources and exact failure messages aggregate without losing matching orders", () => {
  const a = order("failed", {
    orderType: "Limit",
    chunkSummary: {
      lastChunkStatus: "failed",
      lastChunkDescription: "Error A",
    },
  });
  const b = order("failed", {
    orderType: "Limit",
    chunkSummary: {
      lastChunkStatus: "failed",
      lastChunkDescription: "Error A",
    },
  });
  b.source = "v1";
  const c = order("pending", { orderType: "Market" });
  const data = buildOrderDiagnostics([a, b, c], snapshot);
  assert.equal(data.reasons.length, 1);
  assert.equal(data.reasons[0].orders.length, 2);
  assert.equal(data.types[0].label, "Limit");
  assert.equal(data.types[0].value, 20);
  assert.deepEqual(data.sources, [
    ["v1", 1],
    ["v2", 2],
  ]);
});
