import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getOrderConditionComparison,
  getOrderCheckTiming,
} from "../src/lib/activity/order-condition";
import { SpotOrderType } from "../src/lib/twap/types";

const limit = (expected: string, current: string) =>
  `Price can't meet condition: expected ${expected}, got ${current} (1 vs. 2) - 99.0%`;
test("limit comparisons show the receive shortfall without floating point rounding", () => {
  assert.deepEqual(
    getOrderConditionComparison(
      limit("4705.88", "4680.51"),
      SpotOrderType.LIMIT,
    ),
    {
      kind: "limit",
      current: "4680.51",
      target: "4705.88",
      direction: "at-least",
      difference: "25.37",
    },
  );
  assert.equal(
    getOrderConditionComparison(
      limit("0.0000000002", "0.0000000001"),
      SpotOrderType.LIMIT,
    )?.difference,
    "0.0000000001",
  );
});
test("stop-loss and take-profit targets use opposite comparison directions", () => {
  const stop =
    "Trigger price not met, current output 147.39 > triggerLower 139.73 - 94.80%";
  const take =
    "Trigger price not met, current output 90 < triggerUpper 100 - 90%";
  assert.equal(
    getOrderConditionComparison(stop, SpotOrderType.STOP_LOSS_LIMIT)?.direction,
    "at-most",
  );
  assert.equal(
    getOrderConditionComparison(stop, SpotOrderType.STOP_LOSS_LIMIT)
      ?.difference,
    "7.66",
  );
  assert.equal(
    getOrderConditionComparison(take, SpotOrderType.TAKE_PROFIT)?.direction,
    "at-least",
  );
  assert.equal(
    getOrderConditionComparison(take, SpotOrderType.TAKE_PROFIT)?.difference,
    "10",
  );
});
test("unrecognized checks do not invent a quote or target and reached targets have no shortfall", () => {
  assert.equal(
    getOrderConditionComparison("RPC timeout", SpotOrderType.LIMIT),
    undefined,
  );
  assert.equal(
    getOrderConditionComparison(limit("0", "10"), SpotOrderType.LIMIT),
    undefined,
  );
  assert.equal(
    getOrderConditionComparison(limit("10", "11"), SpotOrderType.LIMIT)
      ?.difference,
    "0",
  );
});
test("past automatic check times show awaiting instead of a promised future check", () => {
  const updatedAt = Date.parse("2026-10-13T12:00:00Z");
  assert.deepEqual(getOrderCheckTiming("2026-10-13T11:59:59Z", updatedAt), {
    state: "awaiting",
  });
  assert.deepEqual(getOrderCheckTiming("2026-10-13T12:00:00Z", updatedAt), {
    state: "awaiting",
  });
  assert.deepEqual(getOrderCheckTiming("2026-10-13T12:00:10Z", updatedAt), {
    state: "scheduled",
    time: updatedAt + 10000,
  });
  assert.deepEqual(
    getOrderCheckTiming(String((updatedAt + 10000) / 1000), updatedAt),
    { state: "scheduled", time: updatedAt + 10000 },
  );
  assert.deepEqual(getOrderCheckTiming("invalid", updatedAt), {
    state: "unknown",
  });
  assert.deepEqual(getOrderCheckTiming(undefined, updatedAt), {
    state: "unknown",
  });
});
