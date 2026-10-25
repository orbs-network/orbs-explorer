import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import {
  addressFormat,
  buildSecurityReview,
  checkSecurityAddress,
  SECURITY_RULES,
} from "../apps/ops/src/lib/security-review";

const snapshot = Date.parse("2026-10-21T12:00:00Z");
const minute = 60_000;
const adapter = `0x${"a".repeat(40)}`;
const legacy = `0x${"b".repeat(40)}`;
const unknown = `0x${"c".repeat(40)}`;
const zero = `0x${"0".repeat(40)}`;
const config = {
  137: {
    dex: { test: { adapter } },
    partnerAdapters: [
      { partnerId: "test", partnerName: "Test (old)", adapter: legacy },
    ],
  },
} as unknown as SpotConfig;
let sequence = 0;
function order(
  time = snapshot - 2 * 60 * minute,
  status = "completed",
): ListOrder {
  return {
    hash: `0x${(++sequence).toString(16).padStart(64, "0")}`,
    source: "v2",
    exchangeAdapter: adapter,
    inputToken: zero,
    outputToken: unknown,
    timestamp: new Date(time).toISOString(),
    totalUSDAmount: "1",
    metadata: {
      status,
      chunkSummary: { error: 0, lastChunkStatus: "success" },
    },
    order: { witness: { chainId: 137, deadline: "1800000000" } },
  } as ListOrder;
}
function batch(count: number, start: number, status = "completed") {
  return Array.from({ length: count }, (_, i) =>
    order(start + i * 1000, status),
  );
}

test("address checks distinguish format, optional casing and invalid mixed-case checksum", () => {
  assert.equal(addressFormat(undefined), "missing");
  assert.equal(addressFormat(""), "missing");
  assert.equal(addressFormat("  "), "missing");
  assert.equal(addressFormat("0xabc"), "invalid");
  assert.equal(addressFormat(`0x${"G".repeat(40)}`), "invalid");
  assert.equal(addressFormat(adapter), "valid");
  assert.equal(addressFormat(`0x${"A".repeat(40)}`), "valid");
  assert.equal(
    addressFormat("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"),
    "valid",
  );
  assert.equal(
    addressFormat("0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"),
    "checksum",
  );
});

test("adapter matching is case-insensitive but requires the exact network", () => {
  assert.equal(checkSecurityAddress(adapter, 137, config).match, "current");
  assert.equal(
    checkSecurityAddress(`0x${"A".repeat(40)}`, 137, config).match,
    "current",
  );
  const wrongNetwork = checkSecurityAddress(adapter, 1, config);
  assert.equal(wrongNetwork.match, "other-network");
  assert.deepEqual(wrongNetwork.knownNetworks, [137]);
  assert.equal(checkSecurityAddress(legacy, 137, config).match, "catalog");
  assert.equal(checkSecurityAddress(unknown, 137, config).match, "unknown");
  assert.equal(
    checkSecurityAddress(adapter, undefined, config).match,
    "unavailable",
  );
  assert.equal(checkSecurityAddress(adapter, 137, null).match, "unavailable");
  assert.equal(checkSecurityAddress(adapter, 137, {}).match, "unavailable");
});

test("native token zero addresses are accepted while zero adapters and malformed tokens are flagged", () => {
  const clean = order();
  const bad = order();
  bad.exchangeAdapter = zero;
  const token = order();
  token.outputToken = "bad";
  const mixed = order();
  mixed.inputToken = "0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
  const report = buildSecurityReview(
    [clean, bad, token, mixed],
    snapshot,
    config,
  );
  assert.deepEqual(report.findings[0].orders, [bad, token, mixed]);
  assert.equal(report.flagged.length, 3);
});

test("catalog-only adapters remain separate from current matches and missing config never fabricates matches", () => {
  const old = order();
  old.exchangeAdapter = legacy;
  const fresh = order();
  const values = [old, fresh];
  const report = buildSecurityReview(values, snapshot, config);
  assert.deepEqual(report.currentOrders, [fresh]);
  assert.deepEqual(report.catalogOrders, [old]);
  assert.deepEqual(report.findings[1].orders, []);
  const unavailable = buildSecurityReview(values, snapshot, null);
  assert.equal(unavailable.findings[1].available, false);
  assert.equal(unavailable.currentRegistrySize, 0);
  assert.deepEqual(unavailable.findings[1].orders, []);
  const catalogsOnly = {
    137: { partnerAdapters: config[137].partnerAdapters },
  };
  assert.equal(
    buildSecurityReview([old], snapshot, catalogsOnly).currentRegistrySize,
    0,
  );
});

test("unmapped and wrong-network adapters can be inspected, overlapping findings count unique orders", () => {
  const different = order();
  different.exchangeAdapter = unknown;
  different.outputToken = "bad";
  const wrongNetwork = order();
  wrongNetwork.order.witness.chainId = 1;
  const missing = order();
  missing.order.witness.chainId = 0;
  const report = buildSecurityReview(
    [different, wrongNetwork, missing],
    snapshot,
    config,
  );
  assert.deepEqual(report.findings[1].orders, [different, wrongNetwork]);
  assert.deepEqual(report.missingNetwork, [missing]);
  assert.equal(report.flagged.length, 2);
});

test("order bursts compare one network and adapter against the preceding hour at exact thresholds", () => {
  const start = snapshot - 10 * minute;
  const history = [
    order(start - 2 * 60 * minute),
    ...Array.from({ length: 12 }, (_, i) =>
      batch(4, start - 60 * minute + i * 5 * minute),
    ).flat(),
  ];
  const spike = batch(20, start);
  const report = buildSecurityReview([...history, ...spike], snapshot, config);
  assert.equal(report.bursts.length, 1);
  assert.equal(report.bursts[0].baseline, 4);
  assert.deepEqual(report.bursts[0].orders, spike);
  assert.equal(
    buildSecurityReview([...history, ...spike.slice(0, 19)], snapshot, config)
      .bursts.length,
    0,
  );
  const higherHistory = [
    ...history,
    ...Array.from({ length: 12 }, (_, i) =>
      order(start - 60 * minute + i * 5 * minute + 4000),
    ),
  ];
  assert.equal(
    buildSecurityReview([...higherHistory, ...spike], snapshot, config).bursts
      .length,
    0,
  );
});

test("normal steady activity does not trigger bursts once comparable history exists", () => {
  const history = Array.from({ length: 30 }, (_, i) =>
    batch(30, snapshot - 150 * minute + i * 5 * minute),
  ).flat();
  const report = buildSecurityReview(history, snapshot, config);
  assert.equal(report.bursts.length, 0);
  assert.ok(report.baselineSkipped > 0);
});

test("a burst without preceding history is skipped and old or future activity cannot trigger alerts", () => {
  const spike = batch(20, snapshot - 10 * minute);
  const report = buildSecurityReview(spike, snapshot, config);
  assert.equal(report.bursts.length, 0);
  assert.equal(report.baselineSkipped, 1);
  assert.equal(report.findings[2].available, false);
  const old = batch(
    20,
    snapshot - SECURITY_RULES.lookback - 5 * minute,
    "failed",
  );
  const future = batch(20, snapshot + minute, "failed");
  const invalid = order();
  invalid.timestamp = "invalid";
  const empty = buildSecurityReview(
    [...old, ...future, invalid],
    snapshot,
    config,
  );
  assert.equal(empty.failures.length, 0);
  assert.equal(empty.bursts.length, 0);
  assert.equal(empty.missingTime.length, 21);
});

test("failure clusters require five terminal failures and 80 percent in the same 15-minute cohort", () => {
  const start = snapshot - 15 * minute;
  const failed = batch(5, start, "failed");
  const success = batch(1, start + 10 * 1000);
  const report = buildSecurityReview([...failed, ...success], snapshot, config);
  assert.equal(report.failures.length, 1);
  assert.equal(report.failures[0].failed, 5);
  assert.equal(report.failures[0].orders.length, 6);
  assert.equal(
    buildSecurityReview(
      [...failed, ...batch(2, start + 10 * 1000)],
      snapshot,
      config,
    ).failures.length,
    0,
  );
  assert.equal(
    buildSecurityReview(failed.slice(0, 4), snapshot, config).failures.length,
    0,
  );
  const pending = batch(8, start, "pending");
  pending.forEach((value) => {
    value.metadata.chunkSummary.error = 100;
    value.metadata.chunkSummary.lastChunkStatus = "error";
  });
  assert.equal(
    buildSecurityReview(pending, snapshot, config).failures.length,
    0,
  );
});

test("activity cohorts do not combine unrelated adapters or networks", () => {
  const records = batch(4, snapshot - 15 * minute, "failed");
  const other = order(snapshot - 15 * minute, "failed");
  other.exchangeAdapter = legacy;
  const chain = order(snapshot - 15 * minute, "failed");
  chain.order.witness.chainId = 1;
  assert.equal(
    buildSecurityReview([...records, other, chain], snapshot, config).failures
      .length,
    0,
  );
});

test("empty data has no implied behavioral coverage", () => {
  const report = buildSecurityReview([], snapshot, null);
  assert.deepEqual(report.flagged, []);
  assert.equal(report.findings[1].available, false);
  assert.equal(report.findings[2].available, false);
  assert.equal(report.findings[3].available, false);
});
