"use client";

import type { PartnerStats } from "@/lib/orders-dashboard";
import {
  DollarSign,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MinusCircle,
  LayoutGrid,
} from "lucide-react";

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const tiles = [
  {
    key: "orders",
    label: "Total orders",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.totalOrders, 0),
    icon: LayoutGrid,
    className: "text-foreground",
  },
  {
    key: "usd",
    label: "Total volume (USD)",
    getValue: (stats: PartnerStats[]) =>
      formatUsd(stats.reduce((a, s) => a + s.totalUsd, 0)),
    icon: DollarSign,
    className: "text-foreground",
  },
  {
    key: "filled",
    label: "Filled",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.filledOrders, 0),
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "partial",
    label: "Partially filled",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.partiallyFilledOrders, 0),
    icon: MinusCircle,
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "error",
    label: "Error / failed",
    getValue: (stats: PartnerStats[]) =>
      stats.reduce((a, s) => a + s.errorOrders, 0),
    icon: XCircle,
    className: "text-destructive",
  },
];

export function DashboardSummary({ stats }: { stats: PartnerStats[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {tiles.map(({ key, label, getValue, icon: Icon, className }) => (
        <div
          key={key}
          className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-border/80"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <div className="mt-3 flex items-baseline gap-2">
            <Icon
              className={`h-5 w-5 shrink-0 ${className || "text-muted-foreground"}`}
            />
            <p
              className={`text-2xl font-bold tabular-nums ${className || "text-foreground"}`}
            >
              {getValue(stats)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
