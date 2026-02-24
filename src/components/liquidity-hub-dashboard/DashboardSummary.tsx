"use client";

import { useState, useMemo } from "react";
import type { LHPartnerStats } from "@/lib/liquidity-hub";
import type { LiquidityHubSwap } from "@/lib/liquidity-hub/types";
import {
  CheckCircle2,
  XCircle,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { StatusSwapsModal } from "./StatusSwapsModal";

const sortByCreatedAtDesc = (a: LiquidityHubSwap, b: LiquidityHubSwap) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

const STATUS_TILES = [
  {
    key: "success",
    label: "Success",
    getValue: (stats: LHPartnerStats[]) =>
      stats.reduce((a, s) => a + s.successSwaps, 0),
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
    filter: (s: LiquidityHubSwap) => {
      const st = (s.swapStatus ?? "").toLowerCase();
      return st === "success" || st === "succeeded";
    },
    title: "Success",
    variant: "success" as const,
    emptyMessage: "No successful swaps in this period.",
  },
  {
    key: "failed",
    label: "Failed",
    getValue: (stats: LHPartnerStats[]) =>
      stats.reduce((a, s) => a + s.failedSwaps, 0),
    icon: XCircle,
    className: "text-destructive",
    filter: (s: LiquidityHubSwap) => {
      const st = (s.swapStatus ?? "").toLowerCase();
      return st !== "success" && st !== "succeeded";
    },
    title: "Failed",
    variant: "failed" as const,
    emptyMessage: "No failed swaps in this period.",
  },
];

const SUMMARY_TILES = [
  {
    key: "swaps",
    label: "Total swaps",
    getValue: (stats: LHPartnerStats[]) =>
      stats.reduce((a, s) => a + s.totalSwaps, 0),
    icon: LayoutGrid,
    className: "text-foreground",
  },
  ...STATUS_TILES,
];

export function LHDashboardSummary({
  stats,
  allSwaps = [],
}: {
  stats: LHPartnerStats[];
  allSwaps?: LiquidityHubSwap[];
}) {
  const [openModalKey, setOpenModalKey] = useState<string | null>(null);

  const swapsByStatus = useMemo(() => {
    const acc: Record<string, LiquidityHubSwap[]> = {};
    for (const t of STATUS_TILES) {
      acc[t.key] = allSwaps.filter(t.filter).sort(sortByCreatedAtDesc);
    }
    return acc;
  }, [allSwaps]);

  const usdByTileKey = useMemo(() => {
    const totalUsd = stats.reduce((a, s) => a + s.totalUsd, 0);
    const acc: Record<string, number> = {
      swaps: totalUsd,
    };
    for (const t of STATUS_TILES) {
      acc[t.key] = (swapsByStatus[t.key] ?? []).reduce(
        (sum, s) => sum + (s.amountInUSD ?? s.dollarValue2 ?? 0),
        0
      );
    }
    return acc;
  }, [stats, swapsByStatus]);

  return (
    <>
      <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
        {SUMMARY_TILES.map((tile) => {
          const isStatusTile = "filter" in tile;
          const count = isStatusTile ? tile.getValue(stats) : 0;
          const clickable = isStatusTile && count > 0;
          const className = `rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-all text-left hover:shadow-md hover:border-border/80 flex-1 min-w-[7rem] basis-0 ${
            clickable ? "cursor-pointer" : "cursor-default"
          }`;
          const usd = usdByTileKey[tile.key] ?? 0;
          const content = (
            <>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                {tile.label}
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <tile.icon
                  className={`h-4 w-4 shrink-0 ${tile.className || "text-muted-foreground"}`}
                />
                <p
                  className={`text-lg font-bold tabular-nums truncate ${tile.className || "text-foreground"}`}
                >
                  {tile.getValue(stats)}
                </p>
                {clickable && (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-70 ml-auto" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums truncate">
                <Amount amount={String(usd)} prefix="$" className="text-inherit font-normal" />
              </p>
            </>
          );
          return clickable ? (
            <button
              key={tile.key}
              type="button"
              onClick={() => setOpenModalKey(tile.key)}
              className={className}
            >
              {content}
            </button>
          ) : (
            <div key={tile.key} className={className}>
              {content}
            </div>
          );
        })}
      </div>
      {STATUS_TILES.map((tile) => (
        <StatusSwapsModal
          key={tile.key}
          open={openModalKey === tile.key}
          onOpenChange={(open) => setOpenModalKey(open ? tile.key : null)}
          partnerName="All partners"
          swaps={swapsByStatus[tile.key] ?? []}
          title={tile.title}
          variant={tile.variant}
          emptyMessage={tile.emptyMessage}
        />
      ))}
    </>
  );
}
