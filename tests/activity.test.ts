import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import {
  getOrderStory,
  explainOrderReason,
} from "../packages/domain/src/activity/order-story";
import { findEvent } from "../packages/domain/src/perpetual-hub/find-event";
import { getPerpetualStory } from "../packages/domain/src/activity/perpetual-story";
import { getSwapStory } from "../packages/domain/src/activity/swap-story";
import {
  getSettlementStory,
  isSettlementConfirmed,
} from "../packages/domain/src/activity/settlement-story";
import { parseOrderChunks } from "../packages/domain/src/twap/hooks/use-spot-order-chunks";
import { getLiquidityHubTx } from "../packages/domain/src/liquidity-hub/api";
import type { Order, OrderChunk } from "../packages/domain/src/twap/types";
import { Status } from "../packages/domain/src/twap/types";
import type { LiquidityHubSwap } from "../packages/domain/src/liquidity-hub/types";
import type {
  PerpetualHubOperation,
  PerpetualHubRollup,
} from "../packages/domain/src/perpetual-hub/types";

const now = Date.parse("2026-10-13T12:00:00Z");
const chunk = (status: string, index: number, description = ""): OrderChunk =>
  ({
    status,
    index,
    description,
    inAmount: "25",
    outAmount: "20",
    createdAt: `2026-10-13T10:0${index}:00Z`,
    timestamp: `2026-10-13T10:0${index}:00Z`,
  }) as OrderChunk;
const order = (
  status: string,
  chunks: OrderChunk[] = [],
  deadline = (now + 60_000) / 1000,
): Order =>
  ({
    metadata: { status, chunks, expectedChunks: 4 },
    order: {
      witness: { deadline: String(deadline), input: { maxAmount: "100" } },
    },
  }) as Order;
const event = (
  operationType: string,
  status = "SUCCESS",
): PerpetualHubOperation =>
  ({
    operationType,
    status,
    teeSequence: 42,
    rollupId: 7,
  }) as PerpetualHubOperation;
const rollup = (status: string, extra = {}): PerpetualHubRollup =>
  ({
    status,
    operationsCount: 3,
    oldSequence: 40,
    newSequence: 43,
    ...extra,
  }) as PerpetualHubRollup;

test("a waiting price check keeps the order active and explains its condition", () => {
  const story = getOrderStory(
    order("pending", [chunk("pending", 0, "Limit price not met")]),
    now,
  );
  assert.match(story.title, /Waiting/);
  assert.equal(story.ended, false);
  assert.equal(story.remainingRaw, "100");
});

test("an unsuccessful latest attempt does not cancel the order or erase filled input", () => {
  const story = getOrderStory(
    order("pending", [
      chunk("error", 2, "RPC request failed"),
      chunk("success", 1),
    ]),
    now,
  );
  assert.match(story.title, /attempt did not succeed/);
  assert.equal(story.latest?.index, 2);
  assert.equal(story.ended, false);
  assert.equal(story.progress, 25);
  assert.equal(story.remainingRaw, "75");
});

test("expired and cancelled orders retain their successful executions", () => {
  const expired = getOrderStory(
    order("pending", [chunk("success", 0)], now / 1000 - 1),
    now,
  );
  assert.match(expired.title, /expired after partial/);
  assert.equal(expired.filledRaw, "25");
  const cancelled = order("cancelled", [
    chunk("success", 0),
    chunk("error", 1),
    chunk("canceled", 2),
  ]);
  const parsed = parseOrderChunks(cancelled, { status: Status.CANCELLED });
  assert.equal(parsed.successChunks.length, 1);
  assert.equal(parsed.successChunks[0].status, "success");
  assert.equal(parsed.successChunks[0].exchangeRate, "0");
  assert.equal(parsed.successChunks[0].expectedOutputOracle, "0");
  assert.deepEqual(
    parsed.failedChunks.map((item) => item.status),
    ["error", "canceled"],
  );
  assert.equal(parsed.pendingChunks.length, 0);
});

test("a reported completion with missing history does not invent executed amounts", () => {
  const story = getOrderStory(order("completed"), now);
  assert.equal(story.title, "Order completed");
  assert.equal(story.amountsKnown, false);
  assert.equal(story.ended, true);
});

test("successful order creation is explained separately from a fill and settlement", () => {
  const story = getPerpetualStory(event("CREATE_LIMIT_ORDER"));
  assert.match(story.explanation, /does not show a completed trade/);
  assert.equal(story.title, "Account updated");
  assert.match(story.steps[2].detail, /confirmation is not reported/);
  assert.notEqual(story.steps[2].state, "done");
});

test("rejection preserves the reason and does not claim a successful state change", () => {
  const story = getPerpetualStory({
    ...event("OPEN_POSITION", "REJECTED"),
    rejectReason: "Insufficient balance",
  });
  assert.equal(story.title, "Action rejected");
  assert.equal(story.reason, "Insufficient balance");
  assert.match(story.explanation, /not reported as successful/);
});

test("a transaction hash alone does not confirm a batch; failure overrides a stale confirmation time", () => {
  const pending = rollup("SUBMITTED", { txHash: `0x${"a".repeat(64)}` });
  assert.equal(isSettlementConfirmed(pending), false);
  assert.equal(getSettlementStory(pending).tone, "pending");
  const confirmed = rollup("CONFIRMED", { confirmedAt: now });
  assert.equal(
    getPerpetualStory(event("FILL_ORDER"), confirmed).steps[2].state,
    "done",
  );
  assert.equal(
    isSettlementConfirmed(rollup("FAILED", { confirmedAt: now })),
    false,
  );
});

test("swap execution status stays distinct from network confirmation", () => {
  const story = getSwapStory({
    swapStatus: "success",
    txStatus: "pending",
  } as LiquidityHubSwap);
  assert.match(story.title, /reported successful/);
  assert.match(story.explanation, /verify confirmation/);
  assert.match(story.nextStep, /No blockchain transaction ID/);
});

test("unavailable optional quotes and logs preserve the primary swap outcome", async (t) => {
  let calls = 0;
  t.mock.method(axios, "post", async () => {
    if (++calls > 1) throw new Error("Enrichment unavailable");
    return {
      data: {
        hits: {
          hits: [
            {
              fields: {
                sessionId: ["session-1"],
                swapStatus: ["success"],
                amountIn: ["100"],
              },
            },
          ],
        },
      },
    };
  });
  const result = await getLiquidityHubTx("session-1");
  assert.equal(result?.swap.swapStatus, "success");
  assert.equal(result?.warnings.length, 2);
  assert.equal(result?.quote, undefined);
  assert.deepEqual(result?.quotes, []);
});

test("primary swap outage remains a data-loading error, not a missing or failed swap", async (t) => {
  t.mock.method(axios, "post", async () => {
    throw new Error("Analytics unavailable");
  });
  await assert.rejects(getLiquidityHubTx("session-1"), /Analytics unavailable/);
});

test("recent event lookup does not depend on unavailable older history", async () => {
  const requested: number[] = [];
  const target = { ...event("CREATE_LIMIT_ORDER"), id: 100 };
  const result = await findEvent({
    id: 100,
    seq: 42,
    fetchPage: async (offset) => {
      requested.push(offset);
      if (offset) throw new Error("Older history unavailable");
      return { events: [target], total: 2000 };
    },
  });
  assert.equal(result, target);
  assert.deepEqual(requested, [0]);
});

test("history lookup retains a found event when another requested page fails", async () => {
  const target = { ...event("FILL_ORDER"), id: 100 };
  const fillers = Array.from({ length: 100 }, (_, id) => ({
    ...event("OPEN_POSITION"),
    id: id + 200,
  }));
  const result = await findEvent({
    id: 100,
    fetchPage: async (offset) => {
      if (!offset) return { events: fillers, total: 500 };
      if (offset === 200) return { events: [target], total: 500 };
      throw new Error("History page unavailable");
    },
  });
  assert.equal(result, target);
});

test("a missing event is not asserted when history coverage is incomplete", async () => {
  const fillers = Array.from({ length: 100 }, (_, id) => ({
    ...event("OPEN_POSITION"),
    id: id + 200,
  }));
  await assert.rejects(
    findEvent({
      id: 100,
      fetchPage: async (offset) => {
        if (!offset) return { events: fillers, total: 500 };
        throw new Error("History page unavailable");
      },
    }),
    /History page unavailable/,
  );
});

test("current trigger reason fields are translated without promising execution", () => {
  const reason = explainOrderReason(
    "Trigger price not met, current output 148.75 > triggerLower 139.73 - 93.94%",
    "USDC",
  );
  assert.match(reason!, /currently receive: 148.75 USDC/);
  assert.match(reason!, /starts at: 139.73 USDC/);
  assert.doesNotMatch(reason!, /will fill/);
  assert.doesNotMatch(explainOrderReason("RPC timeout")!, /no longer active/);
});

test("order explanations honor explicit cancellation and expiry from the service", () => {
  const cancelled = order("failed", [chunk("success", 0)]);
  cancelled.metadata.displayOnlyStatus = "CANCELLED";
  const cancelledStory = getOrderStory(cancelled, now);
  assert.match(cancelledStory.title, /cancelled after partial execution/);
  assert.equal(cancelledStory.ended, true);
  assert.equal(cancelledStory.filledRaw, "25");
  const expired = order("failed");
  expired.metadata.displayOnlyStatus = "EXPIRED";
  assert.equal(getOrderStory(expired, now).title, "Order expired");
});
