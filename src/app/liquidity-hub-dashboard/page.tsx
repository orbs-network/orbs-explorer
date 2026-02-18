"use client";

import { useMemo } from "react";
import { Page } from "@/components/page";
import { useLiquidityHubDashboard } from "@/lib/hooks/use-liquidity-hub-dashboard";
import {
  LHPartnerStatsCard,
  LHDashboardSummary,
} from "@/components/liquidity-hub-dashboard";
import { Spinner } from "@/components/ui/spinner";
import { BarChart3, LayoutGrid, Users } from "lucide-react";

export default function LiquidityHubDashboardPage() {
  const { isLoading, isError, error, stats, swapsByPartnerId, allSwaps } =
    useLiquidityHubDashboard();

  if (isLoading) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center min-h-[420px] gap-5">
          <div className="rounded-full bg-primary/10 p-4">
            <Spinner className="h-10 w-10 text-primary" />
          </div>
          <p className="text-foreground font-medium">Loading dashboard</p>
          <p className="text-muted-foreground text-sm max-w-sm text-center">
            Fetching swaps per partner. This may take a moment.
          </p>
        </div>
      </Page>
    );
  }

  if (isError) {
    return (
      <Page>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-destructive max-w-lg">
          <p className="font-semibold">Failed to load dashboard</p>
          <p className="mt-2 text-sm opacity-90">
            {error?.message ?? "Unknown error"}
          </p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="min-h-screen">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-border/80 mb-6 sm:mb-10">
          <div className="relative z-10 px-4 py-6 sm:px-8 sm:py-10">
            <div className="flex items-center gap-2 text-primary mb-2">
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Liquidity Hub Dashboard
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
              Partner swap activity
            </h1>
          </div>
        </div>

        <section className="mb-6 sm:mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </h2>
          <LHDashboardSummary stats={stats} allSwaps={allSwaps} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <Users className="h-4 w-4" />
            All partners ({stats.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stats.map((s) => (
              <LHPartnerStatsCard
                key={s.partnerId}
                stats={s}
                swaps={swapsByPartnerId[s.partnerId] ?? []}
              />
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
