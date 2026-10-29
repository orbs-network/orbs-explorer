import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ListOrder,
  Order,
  OrderChunk,
} from "../packages/domain/src/twap/types";
import {
  chunkReason,
  detailReasonObservations,
  getOrderStatusConflict,
  listOrderMessage,
  matchingListOrder,
  reportedExecutionInput,
  reportedExecutionOutput,
} from "../apps/ops/src/lib/order-evidence";
import { fullOrderToInspectionOrder } from "../apps/ops/src/lib/order-investigation";
import { getFailureReason } from "../apps/ops/src/lib/order-diagnostics";
import { sortedOrderChunks } from "../apps/ops/src/components/investigation/order-presentation";

function full(chunks: Partial<OrderChunk>[] = []): Order {
  return {
    hash: `0x${"a".repeat(64)}`,
    source: "v2",
    timestamp: "2026-10-22T12:00:00Z",
    metadata: {
      status: "pending",
      displayOnlyStatus: "ERROR",
      description: "",
      displayOnlyStatusDescription: "",
      chunks,
    },
    order: {
      witness: {
        chainid: 42161,
        input: { token: `0x${"1".repeat(40)}`, maxAmount: "1000" },
        exchange: {},
      },
    },
  } as Order;
}

test("detail/list/diagnostics preserve the service's translated chunk reason when description is absent", () => {
  const record = full([
    {
      index: 1,
      status: "error",
      extraTitleTranslated: "Execution reverted for an unknown reason.",
      extraTitle: "Long raw transaction diagnostics",
      timestamp: "2026-10-22T12:02:00Z",
    },
  ]);
  const list = fullOrderToInspectionOrder(record, "v2");
  assert.equal(
    chunkReason(record.metadata.chunks[0]),
    "Execution reverted for an unknown reason.",
  );
  assert.deepEqual(listOrderMessage(list), {
    error: true,
    text: "Execution reverted for an unknown reason.",
  });
  assert.equal(getFailureReason(list), listOrderMessage(list).text);
  const observations = detailReasonObservations(
    record,
    sortedOrderChunks(record.metadata.chunks),
    list,
  );
  assert.equal(observations[0].text, listOrderMessage(list).text);
  assert.equal(observations[0].field, "chunk.extraTitleTranslated");
  assert.equal(observations[0].timestamp, "2026-10-22T12:02:00Z");
});

test("missing chunk reasons retain metadata reasons and never manufacture an event timestamp", () => {
  const record = full([{ index: 1, status: "error" }]);
  record.metadata.displayOnlyStatusDescription = "RPC request failed";
  const list = fullOrderToInspectionOrder(record, "v2");
  const observations = detailReasonObservations(
    record,
    record.metadata.chunks,
    list,
  );
  assert.equal(listOrderMessage(list).text, "RPC request failed");
  assert.equal(observations[0].text, "RPC request failed");
  assert.equal(observations[0].timestamp, undefined);
});

test("terminal service reasons lead over a preceding successful chunk and older errors remain historical", () => {
  const record = full([
    {
      index: 1,
      status: "error",
      description: "Earlier RPC error",
      timestamp: "2026-10-22T12:01:00Z",
    },
    {
      index: 2,
      status: "success",
      description: "Earlier trade completed",
      timestamp: "2026-10-22T12:02:00Z",
    },
  ]);
  record.metadata.status = "failed";
  record.metadata.displayOnlyStatus = "FAILED";
  record.metadata.displayOnlyStatusDescription = "Order stopped by the service";
  const list = fullOrderToInspectionOrder(record, "v2");
  const observations = detailReasonObservations(
    record,
    sortedOrderChunks(record.metadata.chunks),
    list,
  );
  assert.equal(observations[0].text, listOrderMessage(list).text);
  assert.equal(
    observations.find((observation) => observation.text === "Earlier RPC error")
      ?.historical,
    true,
  );
  assert.equal(
    observations.find((observation) => observation.text === "Earlier RPC error")
      ?.error,
    false,
  );
});

test("differing lifecycle and execution descriptions stay discoverable without text-based outcome changes", () => {
  const record = full([
    {
      index: 1,
      status: "error",
      description: "expired, last state: pending",
      extraTitleTranslated: "RPC request failed",
    },
  ]);
  record.metadata.status = "failed";
  record.metadata.displayOnlyStatus = "FAILED";
  record.metadata.description = "expired - all chunks errored";
  const list = fullOrderToInspectionOrder(record, "v2");
  const observations = detailReasonObservations(
    record,
    record.metadata.chunks,
    list,
  );
  assert.deepEqual(
    observations.map((observation) => observation.text),
    [
      "expired, last state: pending",
      "RPC request failed",
      "expired - all chunks errored",
    ],
  );
  const conflict = getOrderStatusConflict(list);
  assert.equal(conflict?.kind, "termination-review");
  assert.equal(conflict?.normalizedOutcome, "failed");
  assert.match(
    conflict?.message ?? "",
    /No structured termination-reason code/,
  );
});

test("status conflicts use structured fields but allow active orders to display a latest attempt error", () => {
  const record = full();
  assert.equal(getOrderStatusConflict(record), undefined);
  record.metadata.displayOnlyStatus = "FAILED";
  assert.equal(getOrderStatusConflict(record), undefined);
  record.metadata.status = "cancelled";
  const conflict = getOrderStatusConflict(record);
  assert.equal(conflict?.kind, "structured");
  assert.equal(conflict?.rawStatus, "cancelled");
  assert.equal(conflict?.displayStatus, "FAILED");
  assert.equal(conflict?.normalizedOutcome, "cancelled");
  record.metadata.displayOnlyStatus = "CANCELLED";
  assert.equal(getOrderStatusConflict(record), undefined);
  record.metadata.status = "pending";
  record.metadata.displayOnlyStatus = "PENDING";
  record.metadata.description = "Expired price quote; retrying";
  assert.equal(getOrderStatusConflict(record), undefined);
});

test("list provenance only matches the exact hash, network, and actual returned service", () => {
  const record = full();
  const matching = fullOrderToInspectionOrder(record, "v2");
  const wrongChain = structuredClone(matching);
  wrongChain.order.witness.chainId = 1;
  const wrongSource = { ...matching, source: "v1" } as ListOrder;
  assert.equal(
    matchingListOrder(record, [wrongChain, wrongSource, matching]),
    matching,
  );
  assert.equal(matchingListOrder(record, [wrongChain, wrongSource]), undefined);
  record.source = undefined;
  assert.equal(matchingListOrder(record, [matching]), undefined);
});

test("reported successful input sums exact amounts, never counts retries or estimates missing amounts", () => {
  const record = full([
    { index: 1, status: "success", inAmount: "9007199254740993123456" },
    { index: 2, status: "completed", inAmount: "42" },
    { index: 3, status: "error", inAmount: "999999" },
  ]);
  assert.equal(reportedExecutionInput(record), "9007199254740993123498");
  record.metadata.chunks[1].inAmount = undefined;
  assert.equal(reportedExecutionInput(record), undefined);
  record.metadata.chunks[1].inAmount = "42";
  record.metadata.chunks[1].index = 1;
  assert.equal(reportedExecutionInput(record), undefined);
  assert.equal(
    reportedExecutionInput(full([{ index: 1, status: "error" }])),
    undefined,
  );
  record.metadata.chunks[1].index = 2;
  record.metadata.chunks[1].inToken = `0x${"2".repeat(40)}`;
  assert.equal(reportedExecutionInput(record), undefined);
});

test("reported output received sums successful matching-token fills without estimating missing receipts", () => {
  const record = full([
    { index: 1, status: "success", outAmount: "9007199254740993123456" },
    { index: 2, status: "succeeded", outAmount: "42" },
    { index: 3, status: "error", outAmount: "999999" },
  ]);
  record.order.witness.output = {
    token: `0x${"2".repeat(40)}`,
  } as Order["order"]["witness"]["output"];
  assert.equal(reportedExecutionOutput(record), "9007199254740993123498");
  record.metadata.chunks[1].outAmount = undefined;
  assert.equal(reportedExecutionOutput(record), undefined);
  record.metadata.chunks[1].outAmount = "42";
  record.metadata.chunks[1].outToken = `0x${"3".repeat(40)}`;
  assert.equal(reportedExecutionOutput(record), undefined);
  record.metadata.chunks[1].outToken = record.order.witness.output.token;
  record.metadata.chunks[1].index = 1;
  assert.equal(reportedExecutionOutput(record), undefined);
  record.metadata.chunks = [
    { index: 1, status: "success", outAmount: "0" },
  ] as OrderChunk[];
  assert.equal(reportedExecutionOutput(record), "0");
  record.metadata.chunks = [
    { index: 1, status: "error", outAmount: "50" },
  ] as OrderChunk[];
  assert.equal(reportedExecutionOutput(record), undefined);
});

test("direct detail adaptation orders numeric service timestamps consistently with the history display", () => {
  const record = full([
    {
      index: 7,
      status: "success",
      timestamp: "1792666800",
      description: "older",
    },
    {
      index: 1,
      status: "error",
      timestamp: "1792666860000",
      extraTitleTranslated: "newer",
    },
  ]);
  const list = fullOrderToInspectionOrder(record, "v2");
  assert.equal(list.metadata.chunkSummary.lastChunkDescription, "newer");
  assert.equal(sortedOrderChunks(record.metadata.chunks)[0].index, 1);
});
