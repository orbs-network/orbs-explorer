"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PartnerStats } from "@/lib/orders-dashboard";
import type { ListOrder } from "@/lib/types";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { ErrorOrdersModal } from "./ErrorOrdersModal";

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

function isErrorOrder(order: ListOrder): boolean {
  const status = order.metadata?.status ?? "";
  return (
    status !== "completed" &&
    status !== "partially_completed" &&
    status !== "pending"
  );
}

const statRow = (
  label: string,
  value: string | number,
  icon: React.ReactNode,
  valueClassName?: string,
  onClick?: () => void
) => {
  const content = (
    <>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums flex items-center gap-1 ${valueClassName ?? "text-foreground"}`}
      >
        {value}
        {onClick && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        key={label}
        onClick={onClick}
        className="flex w-full items-center justify-between py-2.5 border-b border-border/50 last:border-0 text-left transition-colors hover:bg-muted/50 rounded-sm -mx-1 px-1 cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      key={label}
      className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
    >
      {content}
    </div>
  );
};

export function PartnerStatsCard({
  stats,
  orders = [],
}: {
  stats: PartnerStats;
  orders?: ListOrder[];
}) {
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const errorOrders = useMemo(
    () =>
      orders
        .filter(isErrorOrder)
        .sort(
          (a, b) =>
            parseFloat(b.totalUSDAmount || "0") -
            parseFloat(a.totalUSDAmount || "0")
        ),
    [orders]
  );

  const hasNoOrders = stats.totalOrders === 0;

  return (
    <>
      <Card
        className={`overflow-hidden border bg-card shadow-sm transition-all hover:shadow-md ${
          hasNoOrders
            ? "border-border/60 opacity-90"
            : "border-border hover:border-primary/20"
        }`}
      >
        <CardHeader className="pb-2 pt-5 px-5">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {stats.partnerName}
          </h3>
          {hasNoOrders && (
            <p className="text-xs text-muted-foreground mt-0.5">
              No orders in last 7 days
            </p>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-0">
          {statRow(
            "Total orders",
            stats.totalOrders,
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          )}
          {statRow(
            "Total USD",
            formatUsd(stats.totalUsd),
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          )}
          {statRow(
            "Filled",
            stats.filledOrders,
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
            "text-emerald-600 dark:text-emerald-400"
          )}
          {statRow(
            "Partially filled",
            stats.partiallyFilledOrders,
            <AlertCircle className="h-4 w-4 text-amber-500" />,
            "text-amber-600 dark:text-amber-400"
          )}
          {statRow(
            "Error / failed",
            stats.errorOrders,
            <XCircle className="h-4 w-4 text-destructive" />,
            "text-destructive",
            () => setErrorModalOpen(true)
          )}
          {stats.pendingOrders > 0 &&
            statRow(
              "Pending",
              stats.pendingOrders,
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
        </CardContent>
      </Card>
      <ErrorOrdersModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        partnerName={stats.partnerName}
        orders={errorOrders}
      />
    </>
  );
}
