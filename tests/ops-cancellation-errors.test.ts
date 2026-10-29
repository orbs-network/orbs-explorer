import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ListOrder,
  Order,
  OrderChunk,
} from "../packages/domain/src/twap/types";
import {
  buildOrderDiagnostics,
  executionErrorCount,
  hasExecutionErrors,
  hasLastExecutionError,
} from "../apps/ops/src/lib/order-diagnostics";
import {
  isCancellationChunk,
  isExecutionErrorChunk,
  listOrderMessage,
} from "../apps/ops/src/lib/order-evidence";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  fullOrderToInspectionOrder,
  investigateOrders,
} from "../apps/ops/src/lib/order-investigation";
import { buildFailureAnalytics } from "../apps/ops/src/lib/execution-analytics";
import { latestOrderError } from "../apps/ops/src/components/investigation/order-presentation";

function cancelled(errors: number | undefined = 1): ListOrder {
  return {
    hash: "cancelled",
    timestamp: "2026-10-23T19:51:11Z",
    order: { witness: { chainId: 4663, deadline: "1792788129", epoch: 300 } },
    metadata: {
      status: "failed",
      displayOnlyStatus: "CANCELLED",
      description: "Cancelled by contract",
      displayOnlyStatusDescription: "TakerError [sendTx] - Execution reverted",
      chunkSummary: {
        error: errors,
        lastChunkStatus: "error",
        lastChunkDescription: "Cancelled by contract",
      },
    },
  } as ListOrder;
}

test("contract cancellation is neutral and excluded from counts, error filters, and analytics", () => {
  const order = cancelled();
  assert.equal(executionErrorCount(order), 0);
  assert.equal(hasExecutionErrors(order), false);
  assert.equal(hasLastExecutionError(order), false);
  assert.deepEqual(listOrderMessage(order), {
    text: "Cancelled by contract",
    error: false,
  });
  for (const errors of ["any", "latest"] as const)
    assert.deepEqual(
      investigateOrders([order], { ...DEFAULT_INVESTIGATION_FILTERS, errors }),
      [],
    );
  assert.deepEqual(
    investigateOrders([order], {
      ...DEFAULT_INVESTIGATION_FILTERS,
      status: "cancelled",
      errors: "none",
    }),
    [order],
  );
  assert.equal(buildOrderDiagnostics([order], Date.now()).errorChunks, 0);
  assert.equal(buildFailureAnalytics([order]).reportedErrors, 0);
  assert.deepEqual(buildFailureAnalytics([order]).history, []);
  // Raw service evidence is retained unchanged.
  assert.equal(order.metadata.chunkSummary.error, 1);
  assert.equal(order.metadata.chunkSummary.lastChunkStatus, "error");
});

test("cancellation removes only its own event, preserving earlier failures and missing counts", () => {
  const earlierFailures = cancelled(3);
  assert.equal(executionErrorCount(earlierFailures), 2);
  assert.equal(hasExecutionErrors(earlierFailures), true);
  assert.equal(hasLastExecutionError(earlierFailures), false);
  const separateFailure = cancelled();
  separateFailure.metadata.chunkSummary.lastChunkDescription =
    "RPC request failed";
  assert.equal(executionErrorCount(separateFailure), 1);
  assert.equal(hasLastExecutionError(separateFailure), true);
  assert.equal(executionErrorCount(cancelled(undefined)), 0);
  const missing = cancelled();
  delete (
    missing.metadata.chunkSummary as Partial<
      ListOrder["metadata"]["chunkSummary"]
    >
  ).error;
  assert.equal(executionErrorCount(missing), undefined);
  assert.equal(executionErrorCount(cancelled(0)), 0);
});

test("detail chunks label cancellation separately and keep real failures in history", () => {
  const cancellation = {
    index: 2,
    status: "error",
    description: "Cancelled by contract",
    timestamp: "2026-10-23T20:32:15Z",
  } as OrderChunk;
  const failed = {
    index: 1,
    status: "error",
    description: "RPC request failed",
    timestamp: "2026-10-23T20:30:00Z",
  } as OrderChunk;
  assert.equal(isCancellationChunk(cancellation), true);
  assert.equal(isExecutionErrorChunk(cancellation), false);
  assert.equal(
    isCancellationChunk({
      ...failed,
      description: "Transaction could not be cancelled",
    }),
    false,
  );
  assert.equal(isExecutionErrorChunk(failed), true);
  const full = {
    ...cancelled(),
    order: { witness: { chainid: 4663, deadline: "1792788129", epoch: 300 } },
    metadata: { ...cancelled().metadata, chunks: [failed, cancellation] },
  } as unknown as Order;
  assert.equal(latestOrderError(full), failed);
  const inspection = fullOrderToInspectionOrder(full, "v2");
  assert.equal(inspection.metadata.chunkSummary.lastChunkStatus, "cancelled");
  assert.equal(executionErrorCount(inspection), 1);
  assert.equal(hasLastExecutionError(inspection), false);
  assert.equal(full.metadata.chunks[1].status, "error");
});
