"use client";

import { useEffect, useState } from "react";
import { snapshotFreshness } from "@/lib/overview-freshness";

export function SnapshotFreshness({
  updatedAt,
  refreshing = false,
  failed = false,
  mode = "polling",
}: {
  updatedAt: number;
  refreshing?: boolean;
  failed?: boolean;
  mode?: "polling" | "manual";
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== "hidden") setNow(Date.now());
    };
    const timer = window.setInterval(update, 15_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const status = snapshotFreshness({ updatedAt, now, refreshing, failed });
  const stale = mode === "manual" ? failed : status.stale;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs tabular-nums ${stale ? "text-warning" : "text-muted-foreground"}`}
      title={`${Number.isFinite(updatedAt) && updatedAt > 0 ? `Order snapshot: ${new Date(updatedAt).toISOString()}. ` : ""}${mode === "manual" ? "Use Refresh order to retrieve the latest record." : "Refreshes every minute while this tab is visible; failed requests retry every five minutes."}`}
    >
      <span
        aria-hidden
        className={`size-1.5 shrink-0 rounded-full ${stale ? "bg-warning" : "bg-success"}`}
      />
      <span className="whitespace-nowrap">{status.label}</span>
    </span>
  );
}
