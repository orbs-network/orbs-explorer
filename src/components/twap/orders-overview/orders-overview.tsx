"use client";

import { useState, useMemo } from "react";
import type { PartnerStats } from "@/lib/twap";
import {
  isListOrderCompleted,
  isListOrderPartiallyCompleted,
  isListOrderPending,
  isListOrderError,
} from "@/lib/twap";
import type { ListOrder } from "@/lib/twap";
import { Amount } from "@/components/ui/amount";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  LayoutGrid,
  Clock,
  ChevronRight,
} from "lucide-react";
import { StatusOrdersModal } from "./status-order-modal";

const sortByCreatedAtDesc = (a: ListOrder, b: ListOrder) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

const STATUS_TILES = [
  {
    key: "filled",
    label: "Filled",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.filledOrders, 0),
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
    filter: isListOrderCompleted,
    title: "Filled",
    variant: "filled" as const,
    emptyMessage: "No filled orders in this period.",
  },
  {
    key: "partial",
    label: "Partially filled",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.partiallyFilledOrders, 0),
    icon: MinusCircle,
    className: "text-amber-600 dark:text-amber-400",
    filter: isListOrderPartiallyCompleted,
    title: "Partially filled",
    variant: "partial" as const,
    emptyMessage: "No partially filled orders in this period.",
  },
  {
    key: "error",
    label: "Error / failed",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.errorOrders, 0),
    icon: XCircle,
    className: "text-destructive",
    filter: isListOrderError,
    title: "Error / failed",
    variant: "error" as const,
    emptyMessage: "No error orders in this period.",
  },
  {
    key: "pending",
    label: "Pending",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.pendingOrders, 0),
    icon: Clock,
    className: "text-muted-foreground",
    filter: isListOrderPending,
    title: "Pending",
    variant: "pending" as const,
    emptyMessage: "No pending orders in this period.",
  },
];

const SUMMARY_TILES = [
  {
    key: "orders",
    label: "Total orders",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.totalOrders, 0),
    icon: LayoutGrid,
    className: "text-foreground",
  },
  ...STATUS_TILES,
];

export function OrdersOverview({
  stats,
  allOrders = [],
}: {
  stats: PartnerStats[];
  allOrders?: ListOrder[];
}) {
  const [openModalKey, setOpenModalKey] = useState<string | null>(null);

  const ordersByStatus = useMemo(() => {
    const acc: Record<string, ListOrder[]> = {};
    for (const t of STATUS_TILES) {
      acc[t.key] = allOrders.filter(t.filter).sort(sortByCreatedAtDesc);
    }
    return acc;
  }, [allOrders]);

  const usdByTileKey = useMemo(() => {
    const totalUsd = stats.reduce((a, s) => a + s.totalUsd, 0);
    const acc: Record<string, number> = {
      orders: totalUsd,
    };
    for (const t of STATUS_TILES) {
      acc[t.key] = (ordersByStatus[t.key] ?? []).reduce(
        (sum, o) => sum + parseFloat(o.totalUSDAmount || "0"),
        0
      );
    }
    return acc;
  }, [stats, ordersByStatus]);

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
        <StatusOrdersModal
          key={tile.key}
          open={openModalKey === tile.key}
          onOpenChange={(open) => setOpenModalKey(open ? tile.key : null)}
          partnerName="All partners"
          orders={ordersByStatus[tile.key] ?? []}
          title={tile.title}
          variant={tile.variant}
          emptyMessage={tile.emptyMessage}
        />
      ))}
    </>
  );
}
