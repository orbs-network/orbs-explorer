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
import { usePartner } from "@/lib/hooks/use-partner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusOrdersModal } from "./StatusOrdersModal";

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

function isFilledOrder(order: ListOrder): boolean {
  return (order.metadata?.status ?? "") === "completed";
}
function isPartiallyFilledOrder(order: ListOrder): boolean {
  return (order.metadata?.status ?? "") === "partially_completed";
}
function isPendingOrder(order: ListOrder): boolean {
  return (order.metadata?.status ?? "") === "pending";
}
function isErrorOrder(order: ListOrder): boolean {
  const status = order.metadata?.status ?? "";
  return (
    status !== "completed" &&
    status !== "partially_completed" &&
    status !== "pending"
  );
}

const sortByCreatedAtDesc = (a: ListOrder, b: ListOrder) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

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
  const [filledModalOpen, setFilledModalOpen] = useState(false);
  const [partialModalOpen, setPartialModalOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const partner = usePartner(stats.partnerId);

  const filledOrders = useMemo(
    () => orders.filter(isFilledOrder).sort(sortByCreatedAtDesc),
    [orders]
  );
  const partialOrders = useMemo(
    () => orders.filter(isPartiallyFilledOrder).sort(sortByCreatedAtDesc),
    [orders]
  );
  const pendingOrders = useMemo(
    () => orders.filter(isPendingOrder).sort(sortByCreatedAtDesc),
    [orders]
  );
  const errorOrders = useMemo(
    () => orders.filter(isErrorOrder).sort(sortByCreatedAtDesc),
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
          <div className="flex items-center gap-3">
            {partner && (
              <Avatar className="h-10 w-10 shrink-0 border border-border">
                <AvatarImage src={partner.logo} alt={stats.partnerName} />
                <AvatarFallback className="text-sm bg-muted">
                  {stats.partnerName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {stats.partnerName}
              </h3>
              {hasNoOrders && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No orders in last 7 days
                </p>
              )}
            </div>
          </div>
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
            "text-emerald-600 dark:text-emerald-400",
            stats.filledOrders > 0 ? () => setFilledModalOpen(true) : undefined
          )}
          {statRow(
            "Partially filled",
            stats.partiallyFilledOrders,
            <AlertCircle className="h-4 w-4 text-amber-500" />,
            "text-amber-600 dark:text-amber-400",
            stats.partiallyFilledOrders > 0 ? () => setPartialModalOpen(true) : undefined
          )}
          {statRow(
            "Error / failed",
            stats.errorOrders,
            <XCircle className="h-4 w-4 text-destructive" />,
            "text-destructive",
            stats.errorOrders > 0 ? () => setErrorModalOpen(true) : undefined
          )}
          {statRow(
            "Pending",
            stats.pendingOrders,
            <Clock className="h-4 w-4 text-muted-foreground" />,
            "text-muted-foreground",
            stats.pendingOrders > 0 ? () => setPendingModalOpen(true) : undefined
          )}
        </CardContent>
      </Card>
      <StatusOrdersModal
        open={filledModalOpen}
        onOpenChange={setFilledModalOpen}
        partnerName={stats.partnerName}
        orders={filledOrders}
        title="Filled"
        variant="filled"
        emptyMessage="No filled orders in this period."
      />
      <StatusOrdersModal
        open={partialModalOpen}
        onOpenChange={setPartialModalOpen}
        partnerName={stats.partnerName}
        orders={partialOrders}
        title="Partially filled"
        variant="partial"
        emptyMessage="No partially filled orders in this period."
      />
      <StatusOrdersModal
        open={pendingModalOpen}
        onOpenChange={setPendingModalOpen}
        partnerName={stats.partnerName}
        orders={pendingOrders}
        title="Pending"
        variant="pending"
        emptyMessage="No pending orders in this period."
      />
      <StatusOrdersModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        partnerName={stats.partnerName}
        orders={errorOrders}
        title="Error / failed"
        variant="error"
        emptyMessage="No error orders in this period."
      />
    </>
  );
}
