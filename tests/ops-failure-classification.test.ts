import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import { classifyFailureReason } from "../apps/ops/src/lib/failure-classification";
import { buildFailureAnalytics } from "../apps/ops/src/lib/execution-analytics";

const row = (
  hash: string,
  status: string,
  reason = "",
  chunk?: { status: string; errors: number; reason: string },
) =>
  ({
    hash,
    totalUSDAmount: "0",
    timestamp: "2026-10-21T10:00:00Z",
    order: { witness: { chainId: 137 } },
    metadata: {
      status,
      description: reason,
      displayOnlyStatus: "",
      ...(chunk
        ? {
            chunkSummary: {
              lastChunkStatus: chunk.status,
              error: chunk.errors,
              lastChunkDescription: chunk.reason,
            },
          }
        : {}),
    },
  }) as ListOrder;

test("reason categories use specific reported text before generic wrappers", () => {
  for (const reason of [
    "Insufficient funds for gas * price + value",
    "ERC20: transfer amount exceeds balance",
    "execution reverted: ERC20InsufficientAllowance",
    "allowance is too low",
    "Not enough balance",
  ])
    assert.equal(classifyFailureReason(reason), "funds", reason);
  for (const reason of [
    "execution reverted",
    "Transaction revert: InvalidPrice",
    "CALL_EXCEPTION",
    "RPC returned execution reverted",
  ])
    assert.equal(classifyFailureReason(reason), "revert", reason);
  for (const reason of [
    "JSON-RPC error -32603",
    "connect ECONNREFUSED 127.0.0.1",
    "Network error",
    "Connection reset by peer",
    "ENOTFOUND endpoint",
  ])
    assert.equal(classifyFailureReason(reason), "rpc", reason);
  for (const reason of [
    "RPC request timed out",
    "Execution timeout",
    "ETIMEDOUT",
    "context deadline exceeded",
  ])
    assert.equal(classifyFailureReason(reason), "timeout", reason);
});

test("missing and generic lifecycle messages do not imply a technical root cause", () => {
  for (const reason of [
    undefined,
    null,
    {},
    "",
    "  ",
    "No failure reason provided",
    "Earlier error reason unavailable in this summary",
  ])
    assert.equal(classifyFailureReason(reason), "unreported");
  for (const reason of [
    "Order expired",
    "Order deadline exceeded",
    "Cancelled by user",
    "Price condition not reached",
    "Unknown error",
    "Allowance check passed",
    "Transaction failed",
  ])
    assert.equal(classifyFailureReason(reason), "other", reason);
});

test("a terminal failure uses its service reason rather than a successful chunk message", () => {
  const terminal = row("terminal", "failed", "RPC connection refused", {
    status: "success",
    errors: 0,
    reason: "Swap completed",
  });
  const unreported = row("unreported", "failed", "", {
    status: "success",
    errors: 0,
    reason: "Swap completed",
  });
  const data = buildFailureAnalytics([terminal, unreported]);
  assert.equal(
    data.reasons.find((group) => group.orders.includes(terminal))!.category,
    "rpc",
  );
  assert.equal(
    data.reasons.find((group) => group.orders.includes(unreported))!.category,
    "unreported",
  );
  assert.ok(data.reasons.every((group) => group.reason !== "Swap completed"));
});

test("reason groups preserve lifecycle outcomes and cannot infer historical messages from a successful latest attempt", () => {
  const lifecycle = row("expired", "expired", "Order expired");
  const cancelled = row("cancelled", "cancelled", "Cancelled by user");
  const active = row("retry", "pending", "Waiting", {
    status: "error",
    errors: 2,
    reason: "execution reverted: insufficient funds",
  });
  const recovered = row("recovered", "completed", "RPC request timed out", {
    status: "success",
    errors: 1,
    reason: "Swap completed",
  });
  const terminal = row("terminal", "failed", "RPC connection refused");
  const expiryWithError = row("expiry-with-error", "expired", "Order expired", {
    status: "error",
    errors: 1,
    reason: "request timed out",
  });
  const data = buildFailureAnalytics([
    lifecycle,
    cancelled,
    active,
    recovered,
    terminal,
    expiryWithError,
  ]);
  assert.deepEqual(data.cohorts.all, [
    active,
    recovered,
    terminal,
    expiryWithError,
  ]);
  assert.deepEqual(data.cohorts.terminal, [terminal]);
  assert.deepEqual(data.cohorts.active, [active]);
  assert.deepEqual(data.cohorts.completed, [recovered]);
  const group = (record: ListOrder) =>
    data.reasons.find((reason) => reason.orders.includes(record))!;
  assert.equal(group(active).category, "funds");
  assert.equal(group(terminal).category, "rpc");
  assert.equal(group(expiryWithError).category, "timeout");
  assert.equal(
    group(recovered).category,
    "unreported",
    "a successful/latest generic message does not describe the earlier error",
  );
  assert.equal(
    data.reasons.reduce((sum, reason) => sum + reason.orders.length, 0),
    data.cohorts.all.length,
  );
});
