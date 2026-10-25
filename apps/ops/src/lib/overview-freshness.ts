export const OVERVIEW_REFRESH_INTERVAL = 60_000;
export const OVERVIEW_ERROR_REFRESH_INTERVAL = 5 * 60_000;
const STALE_AFTER = 2 * OVERVIEW_REFRESH_INTERVAL;

export function overviewRefetchInterval(state: {
  status: "pending" | "success" | "error";
  fetchStatus: "fetching" | "paused" | "idle";
}): number | false {
  if (state.fetchStatus !== "idle") return false;
  return state.status === "error"
    ? OVERVIEW_ERROR_REFRESH_INTERVAL
    : OVERVIEW_REFRESH_INTERVAL;
}

export function snapshotFreshness({
  updatedAt,
  now,
  refreshing = false,
  failed = false,
}: {
  updatedAt: number;
  now: number;
  refreshing?: boolean;
  failed?: boolean;
}): { label: string; stale: boolean } {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0)
    return { label: "Waiting for snapshot", stale: true };
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  const age =
    seconds < 5
      ? "just now"
      : seconds < 60
        ? `${seconds}s ago`
        : seconds < 3600
          ? `${Math.floor(seconds / 60)}m ago`
          : seconds < 86400
            ? `${Math.floor(seconds / 3600)}h ago`
            : `${Math.floor(seconds / 86400)}d ago`;
  return {
    label: `${refreshing ? "Refreshing" : failed ? "Refresh failed" : "Updated"} ${refreshing || failed ? "· " : ""}${age}`,
    stale: failed || now - updatedAt >= STALE_AFTER,
  };
}
