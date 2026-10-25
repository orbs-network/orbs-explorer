import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDataQuality } from "../apps/ops/src/lib/data-quality";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";

const snapshot = Date.parse("2026-10-20T12:00:00Z");
const adapter = `0x${"a".repeat(40)}`;
function order(): ListOrder {
  return {
    hash: `0x${"b".repeat(64)}`,
    source: "v2",
    exchangeAdapter: adapter,
    inputToken: `0x${"0".repeat(40)}`,
    outputToken: `0x${"c".repeat(40)}`,
    timestamp: "2026-10-20T10:00:00Z",
    totalUSDAmount: "0",
    metadata: {
      status: "completed",
      expectedChunks: 1,
      chunkSummary: {
        success: 1,
        error: 0,
        total: 1,
        lastChunkStatus: "success",
        lastChunkExtraError: true,
      },
    },
    order: {
      witness: { chainId: 137, deadline: String((snapshot + 3600000) / 1000) },
    },
  } as ListOrder;
}
const config = { 137: { dex: { test: { adapter } } } } as unknown as SpotConfig;

test("semantic lifecycle conflicts stay visible without reclassifying reported failures", () => {
  const expiredReason = order();
  expiredReason.metadata.status = "failed";
  expiredReason.metadata.displayOnlyStatus = "FAILED";
  expiredReason.metadata.description = "expired - all chunks errored";
  const conflict = order();
  conflict.hash = `0x${"c".repeat(64)}`;
  conflict.metadata.status = "completed";
  conflict.metadata.displayOnlyStatus = "EXPIRED";
  const retry = order();
  retry.hash = `0x${"d".repeat(64)}`;
  retry.metadata.status = "pending";
  retry.metadata.displayOnlyStatus = "ERROR";
  const quality = buildDataQuality(
    [expiredReason, conflict, retry],
    snapshot,
    config,
  );
  assert.deepEqual(quality.statusConflicts, [expiredReason, conflict]);
  assert.ok(quality.flagged.includes(expiredReason));
  assert.ok(quality.flagged.includes(conflict));
  assert.equal(quality.flagged.includes(retry), false);
  assert.equal(expiredReason.metadata.status, "failed");
});

test("data coverage accepts valid zero values, native token addresses and successful records with an extra error flag", () => {
  const value = order();
  const quality = buildDataQuality([value], snapshot, config);
  assert.equal(quality.fields.length, 12);
  assert.equal(
    quality.fields.every((field) => field.present === 1),
    true,
  );
  assert.deepEqual(quality.flagged, []);
  assert.deepEqual(quality.unattributed, []);
});

test("missing and malformed numeric fields remain unknown and overlapping issues count unique records", () => {
  const value = order();
  value.totalUSDAmount = "";
  value.metadata.expectedChunks = -1;
  value.metadata.chunkSummary.success = 1.5;
  value.metadata.chunkSummary.error = NaN;
  const quality = buildDataQuality([value], snapshot, config);
  assert.deepEqual(
    quality.fields
      .filter((field) => field.missing.length)
      .map((field) => field.key),
    ["usd", "expected", "success", "error"],
  );
  assert.deepEqual(quality.flagged, [value]);
  assert.equal(quality.sources[0].priced, 0);
});

test("invalid dates, future placement, unknown outcome and malformed identifiers are auditable", () => {
  const invalid = order();
  invalid.timestamp = "invalid";
  invalid.metadata.status = "unrecognized";
  invalid.hash = "bad";
  invalid.inputToken = "bad";
  invalid.order.witness.deadline = "";
  invalid.order.witness.chainId = 0;
  const future = order();
  future.timestamp = "2026-10-21T12:00:00Z";
  const quality = buildDataQuality([invalid, future], snapshot, config);
  assert.equal(
    quality.fields.find((field) => field.key === "time")?.missing.length,
    2,
  );
  for (const key of ["status", "hash", "tokens", "deadline", "chain"])
    assert.equal(
      quality.fields.find((field) => field.key === key)?.missing.length,
      1,
    );
  assert.equal(quality.sources[0].latest, undefined);
});

test("duplicate identities ignore case but separate networks and legacy chain ids remain valid", () => {
  const first = order();
  const copy = order();
  copy.hash = first.hash.toUpperCase();
  copy.order.witness = {
    chainid: 137,
    deadline: first.order.witness.deadline,
  } as ListOrder["order"]["witness"];
  const other = order();
  other.order.witness.chainId = 56;
  const quality = buildDataQuality([first, copy, other], snapshot, config);
  assert.deepEqual(quality.duplicates, [first, copy]);
  assert.deepEqual(quality.unattributed, [other]);
  assert.equal(
    quality.fields.find((field) => field.key === "chain")?.present,
    3,
  );
});

test("progress inconsistencies require a positive plan and source coverage includes missing attribution", () => {
  const excess = order();
  excess.metadata.chunkSummary.success = 2;
  const zero = order();
  zero.metadata.expectedChunks = 0;
  zero.source = undefined;
  const quality = buildDataQuality([excess, zero], snapshot, null);
  assert.deepEqual(quality.excessProgress, [excess]);
  assert.deepEqual(
    quality.sources.map((source) => [source.source, source.orders.length]),
    [
      ["v2", 1],
      ["Not provided", 1],
    ],
  );
  const empty = buildDataQuality([], snapshot, null);
  assert.equal(
    empty.fields.every((field) => field.present === 0),
    true,
  );
  assert.deepEqual(empty.flagged, []);
});
