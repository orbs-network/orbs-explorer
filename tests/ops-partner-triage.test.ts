import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import type { PartnerChainEntry } from "../packages/domain/src/twap/utils/orders-overview";
import { buildPartnerNetworkTriage } from "../apps/ops/src/components/partners/partner-triage-data";

const snapshot = Date.parse("2026-10-22T10:00:00Z");
function order(
  status: string,
  deadline: number | undefined,
  lastAttempt: string,
  timestamp = "2026-10-22T09:00:00Z",
): ListOrder {
  return {
    hash: `${status}:${deadline}:${lastAttempt}`,
    timestamp,
    order: { witness: { chainId: 42161, deadline } },
    metadata: {
      status,
      chunkSummary: { error: 4, lastChunkStatus: lastAttempt },
    },
  } as unknown as ListOrder;
}
function network(chainId: number, orders: ListOrder[]): PartnerChainEntry {
  return {
    chainId,
    chainName: `Chain ${chainId}`,
    orders,
  } as PartnerChainEntry;
}

test("partner network triage separates terminal failures, active overdue, and latest attempt errors", () => {
  const past = snapshot / 1000;
  const orders = [
    order("failed", past, "error"),
    order("eligible", past, "error"),
    order("eligible", past + 1, "success"),
    order("expired", past, "error"),
    order("completed", past, "success", "2026-10-22T09:30:00Z"),
    order("eligible", undefined, "success", "invalid"),
  ];
  const [row] = buildPartnerNetworkTriage([network(42161, orders)], snapshot);
  assert.equal(row.failed, 1);
  assert.equal(row.failureRate, 1 / 6);
  assert.equal(row.overdue, 1);
  assert.equal(row.latestErrors, 3);
  assert.equal(row.latestPlaced, Date.parse("2026-10-22T09:30:00Z"));
  assert.equal(row.orders, orders);
});

test("known inactive networks and missing-network bucket retain honest empty denominators", () => {
  const rows = buildPartnerNetworkTriage(
    [network(0, []), network(1, [])],
    snapshot,
  );
  assert.deepEqual(
    rows.map((row) => row.chainId),
    [0, 1],
  );
  for (const row of rows) {
    assert.equal(row.failureRate, undefined);
    assert.equal(row.latestPlaced, undefined);
    assert.equal(row.failed + row.overdue + row.latestErrors, 0);
  }
});
