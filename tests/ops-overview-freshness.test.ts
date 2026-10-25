import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OVERVIEW_ERROR_REFRESH_INTERVAL,
  OVERVIEW_REFRESH_INTERVAL,
  overviewRefetchInterval,
  snapshotFreshness,
} from "../apps/ops/src/lib/overview-freshness";
import { spotOverviewOrdersQueryOptions } from "../apps/ops/src/lib/spot-overview-queries";

test("history polling stays foreground-only and backs off after errors without overlapping work", () => {
  const options = spotOverviewOrdersQueryOptions();
  assert.equal(options.refetchIntervalInBackground, false);
  assert.equal(
    overviewRefetchInterval({ status: "success", fetchStatus: "idle" }),
    OVERVIEW_REFRESH_INTERVAL,
  );
  assert.equal(OVERVIEW_REFRESH_INTERVAL, 60_000);
  assert.equal(
    overviewRefetchInterval({ status: "error", fetchStatus: "idle" }),
    OVERVIEW_ERROR_REFRESH_INTERVAL,
  );
  assert.equal(OVERVIEW_ERROR_REFRESH_INTERVAL, 300_000);
  for (const status of ["pending", "success", "error"] as const) {
    for (const fetchStatus of ["fetching", "paused"] as const) {
      assert.equal(overviewRefetchInterval({ status, fetchStatus }), false);
    }
  }
});

test("snapshot freshness exposes stale or failed data without hiding its age", () => {
  const updatedAt = Date.parse("2026-10-21T10:00:00Z");
  const status = (elapsed: number, flags = {}) =>
    snapshotFreshness({ updatedAt, now: updatedAt + elapsed, ...flags });
  assert.deepEqual(status(0), { label: "Updated just now", stale: false });
  assert.deepEqual(status(20_000), { label: "Updated 20s ago", stale: false });
  assert.deepEqual(status(60_000), { label: "Updated 1m ago", stale: false });
  assert.deepEqual(status(120_000), { label: "Updated 2m ago", stale: true });
  assert.deepEqual(status(3_600_000), { label: "Updated 1h ago", stale: true });
  assert.deepEqual(status(86_400_000), {
    label: "Updated 1d ago",
    stale: true,
  });
  assert.deepEqual(status(20_000, { failed: true }), {
    label: "Refresh failed · 20s ago",
    stale: true,
  });
  assert.deepEqual(status(120_000, { refreshing: true }), {
    label: "Refreshing · 2m ago",
    stale: true,
  });
  assert.deepEqual(status(-30_000), {
    label: "Updated just now",
    stale: false,
  });
  for (const timestamp of [0, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      snapshotFreshness({ updatedAt: timestamp, now: updatedAt }),
      { label: "Waiting for snapshot", stale: true },
    );
  }
});
