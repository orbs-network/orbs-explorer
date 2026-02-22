"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LHPartnerStats } from "@/lib/liquidity-hub-dashboard";
import type { LiquidityHubSwap } from "@/lib/liquidity-hub/types";
import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { usePartner } from "@/lib/hooks/use-partner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { abbreviate } from "@/lib/utils/utils";
import { StatusSwapsModal } from "./StatusSwapsModal";

const sortByCreatedAtDesc = (a: LiquidityHubSwap, b: LiquidityHubSwap) =>
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

export function LHPartnerStatsCard({
  stats,
  swaps = [],
}: {
  stats: LHPartnerStats;
  swaps?: LiquidityHubSwap[];
}) {
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [failedModalOpen, setFailedModalOpen] = useState(false);
  const partner = usePartner(stats.partnerId);

  const successSwaps = useMemo(
    () =>
      swaps.filter((s) => (s.swapStatus ?? "").toLowerCase() === "success" || (s.swapStatus ?? "").toLowerCase() === "succeeded").sort(sortByCreatedAtDesc),
    [swaps]
  );
  const failedSwaps = useMemo(
    () =>
      swaps.filter((s) => {
        const st = (s.swapStatus ?? "").toLowerCase();
        return st !== "success" && st !== "succeeded";
      }).sort(sortByCreatedAtDesc),
    [swaps]
  );

  const hasNoSwaps = stats.totalSwaps === 0;

  return (
    <>
      <Card
        className={`overflow-hidden border bg-card shadow-sm transition-all hover:shadow-md ${
          hasNoSwaps
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
              {hasNoSwaps && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No swaps in last 7 days
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-0">
          {statRow(
            "Total swaps",
            stats.totalSwaps,
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          )}
          {statRow(
            "Total USD",
            `$${abbreviate(stats.totalUsd)}`,
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          )}
          {statRow(
            "Success",
            stats.successSwaps,
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
            "text-emerald-600 dark:text-emerald-400",
            stats.successSwaps > 0 ? () => setSuccessModalOpen(true) : undefined
          )}
          {statRow(
            "Failed",
            stats.failedSwaps,
            <XCircle className="h-4 w-4 text-destructive" />,
            "text-destructive",
            stats.failedSwaps > 0 ? () => setFailedModalOpen(true) : undefined
          )}
        </CardContent>
      </Card>
      <StatusSwapsModal
        open={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        partnerName={stats.partnerName}
        swaps={successSwaps}
        title="Success"
        variant="success"
        emptyMessage="No successful swaps in this period."
      />
      <StatusSwapsModal
        open={failedModalOpen}
        onOpenChange={setFailedModalOpen}
        partnerName={stats.partnerName}
        swaps={failedSwaps}
        title="Failed"
        variant="failed"
        emptyMessage="No failed swaps in this period."
      />
    </>
  );
}
