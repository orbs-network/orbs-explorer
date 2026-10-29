import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ListOrder,
  Order,
  OrderChunk,
} from "../packages/domain/src/twap/types";
import {
  latestOrderError,
  orderListMessage,
  reportedScheduleValue,
  reportedTime,
  sortedOrderChunks,
  tokenUnits,
  orderRowStatus,
  compactOrderType,
  compactOrderNetwork,
  relativeOrderTime,
  compactTokenAmount,
  conciseOrderMessage,
  isZeroOutputLimit,
  orderScheduleLabel,
  orderSummaryHeading,
  parseOutputShortfall,
} from "../apps/ops/src/components/investigation/order-presentation";

test("output shortfalls separate the user minimum, available net output, and fee-inclusive deficit without precision loss", () => {
  const message =
    "Swap output insufficient: balance=16831374152465104366, resolved=16773097979398049803, fees=83975211216756561, required=16857073190614806364";
  const result = parseOutputShortfall(message)!;
  assert.equal(result.availableAfterFees, "16747398941248347805");
  assert.equal(result.executionMinimum, result.orderMinimum);
  assert.equal(result.shortfall, "25699038149701998");
  assert.equal(
    compactTokenAmount(tokenUnits(result.orderMinimum, 18)!),
    "16.7731",
  );
  assert.equal(
    compactTokenAmount(tokenUnits(result.availableAfterFees, 18)!),
    "16.7474",
  );
  assert.equal(compactTokenAmount(tokenUnits(result.shortfall, 18)!), "0.0257");
  assert.equal(
    conciseOrderMessage(message),
    "Swap output is below the required minimum after fees.",
  );
});

test("output comparisons handle other token decimals, higher execution minimums, and balances below fees", () => {
  const higher = parseOutputShortfall(
    "Swap output insufficient: balance=1950000, resolved=1800000, fees=100000, required=2100000",
  )!;
  assert.equal(tokenUnits(higher.orderMinimum, 6), "1.8");
  assert.equal(tokenUnits(higher.executionMinimum, 6), "2");
  assert.equal(tokenUnits(higher.availableAfterFees, 6), "1.85");
  assert.equal(tokenUnits(higher.shortfall, 6), "0.15");
  const belowFees = parseOutputShortfall(
    "Swap output insufficient: balance=1, resolved=10, fees=2, required=12",
  )!;
  assert.equal(belowFees.availableAfterFees, "0");
  assert.equal(belowFees.shortfall, "11");
  assert.equal(
    parseOutputShortfall(
      "Swap output insufficient: balance=9, resolved=10, fees=0, required=10",
    )?.availableAfterFees,
    "9",
  );
});

test("incomplete, malformed, or inconsistent output diagnostics do not invent comparable quantities", () => {
  for (const message of [
    "Swap output insufficient: balance=1, resolved=2",
    "Swap output insufficient: balance=-1, resolved=2, fees=0, required=2",
    "Swap output insufficient: balance=1, resolved=2, fees=0, required=2.5",
    "Swap output insufficient: balance=1, resolved=2, fees=0, required=2e18",
    "Swap output insufficient: balance=3, resolved=2, fees=0, required=2",
    "Swap output insufficient: balance=1, resolved=2, fees=2, required=3",
    "Some unrelated execution error",
  ])
    assert.equal(parseOutputShortfall(message), undefined, message);
});

test("summary headings prioritize lifecycle over historical reasons and distinguish active failures", () => {
  const order = (status: string) => ({ metadata: { status } }) as ListOrder;
  const waiting = "Price can't meet condition: expected 480.00, got 411.62";
  assert.equal(
    orderSummaryHeading(order("pending"), waiting, false),
    "Waiting for target price",
  );
  assert.equal(
    orderSummaryHeading(order("pending"), waiting, true),
    "Latest attempt failed",
  );
  assert.equal(
    orderSummaryHeading(order("pending"), "Scheduled for later", false),
    "Order is active",
  );
  assert.equal(
    orderSummaryHeading(order("completed"), waiting, true),
    "Order completed",
  );
  assert.equal(
    orderSummaryHeading(order("cancelled"), waiting, true),
    "Order cancelled",
  );
  assert.equal(
    orderSummaryHeading(order("expired"), waiting, true),
    "Order expired",
  );
  assert.equal(
    orderSummaryHeading(order("failed"), waiting, false),
    "Order failed",
  );
});

test("order summary keeps service amounts exact while moving raw integer comparisons out of the readable reason", () => {
  const raw =
    "Price can't meet condition: expected 146258.50, got 70951.12 (70951120361712178198254 vs. 146258503401360544217690) - 48.51%";
  assert.equal(
    conciseOrderMessage(raw),
    "Trading condition not met: expected 146258.50, currently 70951.12 (51.49% below target).",
  );
  assert.equal(
    conciseOrderMessage("RPC Request failed.\nDetailed payload"),
    "RPC Request failed.",
  );
  assert.equal(
    conciseOrderMessage("Chunk executed successfully (fill event)"),
    "Chunk executed successfully (fill event)",
  );
  assert.ok(conciseOrderMessage("x".repeat(400)).length <= 240);
});

test("condition messages show target-relative differences instead of the reported ratio", () => {
  const message =
    "Price can't meet condition: expected 190.18, got 178.27 (178267679 vs. 190177833) - 93.74%";
  assert.equal(
    conciseOrderMessage(message),
    "Trading condition not met: expected 190.18, currently 178.27 (6.26% below target).",
  );
  assert.equal(
    conciseOrderMessage(
      "Price can't meet condition: expected 100, got 110 - 999%",
    ),
    "Trading condition not met: expected 100, currently 110 (10% above target).",
  );
  assert.equal(
    conciseOrderMessage(
      "Price can't meet condition: expected 0.00, got 0.00 (99 vs. 100) - 99%",
    ),
    "Trading condition not met: expected 0.00, currently 0.00 (1% below target).",
  );
  assert.equal(
    conciseOrderMessage(
      "Price can't meet condition: expected 0, got 10 (10 vs. 0) - 0%",
    ),
    "Trading condition not met: expected 0, currently 10.",
  );
  assert.equal(
    conciseOrderMessage(
      "Trigger price not met, current output 147.39 > triggerLower 139.73 - 94.80%",
    ),
    "Trigger condition not met: target 139.73, currently 147.39 (5.48% above target).",
  );
});

test("an explicit zero output limit stays distinct from missing, invalid, and positive limits", () => {
  for (const raw of ["0", "000", " 0 "])
    assert.equal(isZeroOutputLimit(raw), true);
  for (const raw of [
    undefined,
    null,
    "",
    "invalid",
    "-1",
    "0.0",
    "1",
    "1000000000000000000000000001",
  ])
    assert.equal(isZeroOutputLimit(raw), false);
});

test("schedule labels reserve next for a valid future time relative to the retrieved snapshot", () => {
  const snapshot = Date.parse("2026-10-24T09:45:00Z");
  assert.equal(
    orderScheduleLabel("price", "2026-10-24T09:38:00Z", snapshot),
    "Reported price check time",
  );
  assert.equal(
    orderScheduleLabel("eligible", snapshot, snapshot),
    "Reported eligible time",
  );
  assert.equal(
    orderScheduleLabel("eligible", "2026-10-24T09:46:00Z", snapshot),
    "Next reported eligible time",
  );
  assert.equal(
    orderScheduleLabel("retry", "2026-10-24T09:46:00Z", snapshot),
    "Retry eligible after",
  );
  assert.equal(
    orderScheduleLabel("price", "not reported", snapshot),
    "Reported price check time",
  );
  assert.equal(
    orderScheduleLabel("eligible", "2026-10-24T09:46:00Z", NaN),
    "Reported eligible time",
  );
});

const list = (status: string, chunkStatus: string, description = "") =>
  ({
    metadata: {
      status,
      description: "Service rejected order",
      displayOnlyStatusDescription: "",
      chunkSummary: {
        lastChunkStatus: chunkStatus,
        lastChunkDescription: description,
      },
    },
  }) as ListOrder;
const chunk = (index: number, status: string, timestamp: string) =>
  ({ index, status, timestamp }) as OrderChunk;

test("triage message leads with a current chunk failure, but does not label recovered history as a current error", () => {
  assert.deepEqual(
    orderListMessage(list("pending", "error", "TakerError reverted")),
    { text: "TakerError reverted", error: true },
  );
  assert.deepEqual(
    orderListMessage(list("completed", "success", "Swap completed")),
    { text: "Swap completed", error: false },
  );
  assert.deepEqual(
    orderListMessage(list("failed", "success", "Earlier chunk succeeded")),
    { text: "Service rejected order", error: true },
  );
  const missing = list("failed", "failed", " ");
  missing.metadata.description = " ";
  assert.deepEqual(orderListMessage(missing), {
    text: "No failure reason reported",
    error: true,
  });
});

test("latest execution error follows reported chronology and preserves the input array", () => {
  const records = [
    chunk(8, "failed", "2026-10-20T12:00:00Z"),
    chunk(2, "error", "2026-10-21T12:00:00Z"),
    chunk(9, "success", "2026-10-21T13:00:00Z"),
  ];
  assert.deepEqual(
    sortedOrderChunks(records).map((record) => record.index),
    [9, 2, 8],
  );
  assert.equal(
    latestOrderError({ metadata: { chunks: records } } as Order)?.index,
    2,
  );
  assert.deepEqual(
    records.map((record) => record.index),
    [8, 2, 9],
  );
  assert.equal(
    latestOrderError({
      metadata: { chunks: [chunk(1, "success", "")] },
    } as Order),
    undefined,
  );
});

test("chunk ordering falls back to reported creation times and indexes when timestamps are unavailable", () => {
  const created = {
    ...chunk(1, "failed", "invalid"),
    createdAt: "2026-10-20T10:00:00Z",
  };
  assert.deepEqual(
    sortedOrderChunks([
      chunk(3, "failed", ""),
      created,
      chunk(2, "success", ""),
    ]).map((record) => record.index),
    [1, 3, 2],
  );
});

test("known decimal amounts retain exact precision, including zero-decimal and zero values", () => {
  assert.equal(tokenUnits("85077000000000000000", 18), "85.077");
  assert.equal(
    tokenUnits("9007199254740993123456", 6),
    "9007199254740993.123456",
  );
  assert.equal(tokenUnits("42", 0), "42");
  assert.equal(tokenUnits("0", 18), "0");
  for (const [raw, decimals] of [
    ["1", undefined],
    ["1", -1],
    ["1", 1.5],
    ["1", 256],
    ["1e18", 18],
    ["-1", 18],
    ["", 18],
  ])
    assert.equal(tokenUnits(raw, decimals), undefined);
});

test("reported schedule values accept service ISO/epoch values without inventing times for counters or missing fields", () => {
  const expected = Date.parse("2026-10-21T12:00:00Z");
  assert.equal(reportedTime("2026-10-21T12:00:00Z"), expected);
  assert.equal(reportedTime(expected), expected);
  assert.equal(reportedTime(String(expected / 1000)), expected);
  for (const value of ["", undefined, null, "invalid", "60", 0, -1, true, {}])
    assert.equal(reportedTime(value), undefined);
});

test("schedule presentation tolerates numeric epochs and malformed optional service values", () => {
  const iso = "2026-10-21T12:00:00Z";
  const epoch = Date.parse(iso) / 1000;
  assert.equal(reportedScheduleValue(epoch), String(epoch));
  assert.equal(reportedTime(reportedScheduleValue(epoch)), Date.parse(iso));
  assert.equal(reportedScheduleValue({}, iso), iso);
  assert.equal(reportedScheduleValue("  ", iso), iso);
  assert.equal(reportedScheduleValue(null, false, NaN), undefined);
});

test("active row status keeps attempt failures in the errors column and retains explicit waiting reports", () => {
  assert.equal(
    orderRowStatus(list("pending", "error", "TakerError reverted")),
    "Active",
  );
  assert.equal(orderRowStatus(list("pending", "", "")), "Active · waiting");
  assert.equal(
    orderRowStatus(list("eligible", "pending", "Awaiting next attempt")),
    "Active · waiting",
  );
  assert.equal(
    orderRowStatus(list("eligible", "", "Price can't meet condition")),
    "Active · waiting",
  );
  const missing = list("eligible", "", "");
  missing.metadata.description = "";
  assert.equal(orderRowStatus(missing), "Active");
  const recovered = list("eligible", "success", "Trade completed");
  recovered.metadata.chunkSummary.error = 12;
  assert.equal(orderRowStatus(recovered), "Active");
  assert.equal(
    orderRowStatus(list("completed", "success", "Trade completed")),
    "Completed",
  );
  assert.equal(
    orderRowStatus(list("failed", "success", "Trade completed")),
    "Failed",
  );
});

test("compact type and network labels retain exact full-name context without inventing catalog entries", () => {
  assert.equal(
    compactOrderType("TWAP Take Profit Order"),
    "TWAP · take profit",
  );
  assert.equal(compactOrderType("TWAP_STOP_LOSS_ORDER"), "TWAP · stop loss");
  assert.equal(compactOrderType("TWAP TP"), "TWAP · take profit");
  assert.equal(compactOrderType("Limit Order"), "Limit");
  assert.equal(compactOrderType("Custom order"), "Custom order");
  assert.equal(compactOrderType(undefined), "—");
  assert.equal(compactOrderNetwork(42161).label, "Arbitrum One");
  assert.match(compactOrderNetwork(42161).title, /Arbitrum One.*42161/);
  assert.equal(compactOrderNetwork(4663).label, "Robinhood Chain");
  assert.equal(compactOrderNetwork(undefined).label, "Chain unreported");
});

test("token quantities round without ellipses or loss of integer precision", () => {
  assert.equal(compactTokenAmount("138842.918482003921833501"), "138,842.9185");
  assert.equal(
    compactTokenAmount("9007199254740993.123456"),
    "9,007,199,254,740,993.1235",
  );
  assert.equal(compactTokenAmount("217.741123456"), "217.7411");
  assert.equal(compactTokenAmount("52911.0943789"), "52,911.0944");
  assert.equal(compactTokenAmount("14588.6556211"), "14,588.6556");
  assert.equal(compactTokenAmount("0.000000001234567"), "0.000000001235");
  assert.equal(compactTokenAmount("0.001234567"), "0.001235");
  assert.equal(compactTokenAmount("0.0000000000000001"), "<0.000000000001");
  assert.equal(compactTokenAmount("0.0000000000009"), "<0.000000000001");
  assert.equal(compactTokenAmount("999.99995"), "1,000");
  assert.equal(compactTokenAmount("0.99999"), "1");
  assert.equal(
    compactTokenAmount("9007199254740999.99999"),
    "9,007,199,254,741,000",
  );
  assert.equal(compactTokenAmount("42.120000"), "42.12");
  assert.equal(compactTokenAmount("42"), "42");
  assert.equal(compactTokenAmount("0"), "0");
});

test("placed times use a supplied snapshot clock and keep invalid/future reports explicit", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  assert.equal(
    relativeOrderTime(new Date(now - 5_000).toISOString(), now),
    "just now",
  );
  assert.equal(relativeOrderTime(now - 120_000, now), "2m ago");
  assert.equal(relativeOrderTime(now - 7_200_000, now), "2h ago");
  assert.equal(relativeOrderTime(now - 172_800_000, now), "2d ago");
  assert.equal(relativeOrderTime(now + 180_000, now), "in 3m");
  assert.equal(relativeOrderTime("invalid", now), "Unreported");
  assert.equal(relativeOrderTime(now, 0), "Unreported");
});
