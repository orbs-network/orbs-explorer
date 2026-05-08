"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/utils";

type Props = {
  /** Unix timestamp in seconds OR milliseconds (auto-detected). */
  timestamp: number;
  className?: string;
};

function detectMs(ts: number): number {
  // Anything below ~year 2300 in seconds is < 1e10. Above that it's ms.
  return ts > 1e12 ? ts : ts * 1000;
}

function formatAge(deltaMs: number): string {
  if (deltaMs < 0) return "in the future";
  const s = Math.floor(deltaMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function RelativeTime({ timestamp, className }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = detectMs(timestamp);
  const absolute = new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";

  return (
    <span
      className={cn("font-mono text-muted-foreground", className)}
      title={absolute}
      suppressHydrationWarning
    >
      {formatAge(now - ms)}
    </span>
  );
}
