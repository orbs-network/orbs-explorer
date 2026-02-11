"use client";

import { Page } from "@/components/page";
import { useOrdersDashboard } from "@/lib/hooks/use-orders-dashboard";
import {
  PartnerStatsCard,
  DashboardSummary,
} from "@/components/orders-dashboard/index";
import { Spinner } from "@/components/ui/spinner";
import {
  BarChart3,
  Calendar,
  LayoutGrid,
  PieChart as PieChartIcon,
  Users,
} from "lucide-react";

export default function OrdersDashboardPage() {
  const { isLoading, isError, error, stats, ordersByPartnerId } =
    useOrdersDashboard();

  if (isLoading) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center min-h-[420px] gap-5">
          <div className="rounded-full bg-primary/10 p-4">
            <Spinner className="h-10 w-10 text-primary" />
          </div>
          <p className="text-foreground font-medium">Loading dashboard</p>
          <p className="text-muted-foreground text-sm max-w-sm text-center">
            Fetching orders per partner. This may take a moment.
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
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-border/80 mb-10">
          <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex items-center gap-2 text-primary mb-2">
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Orders Dashboard
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Partner order activity
            </h1>
          </div>
        </div>

        {/* Overview */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </h2>
          <DashboardSummary stats={stats} />
        </section>


        {/* Partner cards - all partners */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <Users className="h-4 w-4" />
            All partners ({stats.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stats.map((s) => (
              <PartnerStatsCard
                key={s.partnerId}
                stats={s}
                orders={ordersByPartnerId[s.partnerId] ?? []}
              />
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
