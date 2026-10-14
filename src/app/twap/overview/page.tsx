"use client";

import { Page } from "@/components/page";
import { useSpotOverview } from "@/lib/twap/hooks/use-spot-overview";
import { PartnerStatsCard } from "@/components/twap/orders-overview/partner-stats-card";
import { OrdersOverview } from "@/components/twap/orders-overview/orders-overview";
import { FilterCombobox } from "@/components/filter-combobox";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useQueryFilterParams } from "@/lib/hooks/use-query-filter-params";
import { useQueryParams, StringParam } from "use-query-params";
import { RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "All available history", value: "all" },
];
export default function TwapOverviewPage() {
  const { query, setQuery } = useQueryFilterParams();
  const [periodQuery, setPeriod] = useQueryParams(
    { period: StringParam },
    { updateType: "pushIn" },
  );
  const period = PERIOD_OPTIONS.some(
    (option) => option.value === periodQuery.period,
  )
    ? periodQuery.period!
    : "7";
  const overview = useSpotOverview({
    days: period === "all" ? undefined : Number(period),
    chainIds: query.chain_id,
    partnerIds: query.partner_id,
  });
  const {
    isLoading,
    isError,
    retry,
    partnerCards,
    orders,
    updatedAt,
    isRefreshing,
    refresh,
    warnings,
  } = overview;
  const scopeKey = `${period}:${(query.chain_id ?? []).join(",")}:${(query.partner_id ?? []).join(",")}`;
  const reset = () => {
    setQuery.updateQuery({ chain_id: undefined, partner_id: undefined });
    setPeriod({ period: undefined });
  };
  return (
    <Page>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Order activity
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              See which orders completed, which are still active, and which
              ended. These totals cover all users of the selected trading apps.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/twap">
                Find your order
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh overview"
              title="Refresh overview"
              onClick={refresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                aria-hidden
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
              />
            </Button>
          </div>
        </header>
        <section
          aria-label="Overview filters"
          className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3"
        >
          <FilterCombobox
            label="Period"
            options={PERIOD_OPTIONS}
            value={[period]}
            onChange={(values) => setPeriod({ period: values[0] ?? undefined })}
          />
          <FilterCombobox
            label="Networks"
            options={overview.networkOptions}
            mode="multiple"
            value={query.chain_id ?? []}
            onChange={(values) =>
              setQuery.updateQuery({
                chain_id: values.length ? values : undefined,
              })
            }
          />
          <FilterCombobox
            label="Trading apps"
            options={overview.partnerOptions}
            mode="multiple"
            value={query.partner_id ?? []}
            onChange={(values) =>
              setQuery.updateQuery({
                partner_id: values.length ? values : undefined,
              })
            }
          />
        </section>
        {updatedAt > 0 && (
          <p className="text-xs text-muted-foreground">
            Orders placed:{" "}
            {period === "all"
              ? "all history returned by both order services"
              : `last ${period} days`}
            . Updated{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(updatedAt)}
            .
          </p>
        )}
        {warnings.map((warning) => (
          <p
            key={warning}
            role="status"
            className="rounded-lg border border-amber-600/30 bg-amber-500/5 p-3 text-sm text-foreground"
          >
            {warning}
          </p>
        ))}
        {isLoading ? (
          <div
            role="status"
            className="flex min-h-64 flex-col items-center justify-center gap-3"
          >
            <Spinner className="size-8 text-primary" />
            <p className="font-medium">Loading order activity…</p>
            <p className="text-center text-sm text-muted-foreground">
              Checking both order services for a complete overview.
            </p>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-6"
          >
            <h2 className="font-semibold">Order activity is unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              One or more order services could not be reached. Try again to load
              complete totals.
            </p>
            <Button variant="outline" className="mt-4" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <OrdersOverview key={scopeKey} allOrders={orders} />
            <section aria-label="Trading app activity" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  Trading apps{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({partnerCards.length})
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Most orders first · select a count to see its orders
                </p>
              </div>
              {partnerCards.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {partnerCards.map((card) => (
                    <PartnerStatsCard
                      key={`${scopeKey}:${card.partnerId}`}
                      partnerCard={card}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border p-8 text-center">
                  <h3 className="font-medium">No orders in this view</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try a different period, network, or trading app.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={reset}>
                    Reset overview filters
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Page>
  );
}
