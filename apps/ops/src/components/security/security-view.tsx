"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import { Badge } from "@orbs/ui/controls/badge";
import { Network } from "@orbs/ui/controls/network";
import { useOperationsData } from "@/components/operations/operations-view";
import { EmptyState, Panel } from "@/components/operations/primitives";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import {
  buildSecurityReview,
  type DashboardAccess,
  type SecurityCluster,
} from "@/lib/security-review";

import { ViewTabs } from "@/components/view-tabs";
import { globalScopeHref } from "@/lib/partner-navigation";
import { SystemHealth } from "@/components/operations/system-health";
import { InfoHint } from "@/components/info-hint";
import { TableSkeleton } from "@/components/loading-skeletons";

function HistoryBoundary({ children }: { children: ReactNode }) {
  const { isLoading, isError, retry } = useOperationsData();
  if (isLoading)
    return (
      <TableSkeleton label="Loading security checks" columns={6} rows={4} />
    );
  if (isError)
    return (
      <section
        role="alert"
        className="space-y-3 rounded-lg bg-destructive/10 p-4"
      >
        <p className="text-sm">
          Order checks are unavailable. Complete history could not be loaded.
        </p>
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      </section>
    );
  return children;
}

function ClusterList({
  title,
  clusters,
  kind,
}: {
  title: string;
  clusters: SecurityCluster[];
  kind: "bursts" | "failures";
}) {
  const { inspectOrders } = useOperationsData();
  const [limit, setLimit] = useState(10);
  if (!clusters.length) return null;
  return (
    <Panel
      title={title}
      description="Select a group to inspect the matching orders. A signal is a reason to investigate, not proof of an attack."
    >
      <div className="divide-y divide-border">
        {clusters.slice(0, limit).map((cluster) => (
          <Button
            variant="ghost"
            size="content"
            type="button"
            key={cluster.key}
            onClick={() =>
              inspectOrders(
                title,
                cluster.orders,
                kind === "bursts"
                  ? "Orders in the flagged five-minute placement bucket."
                  : "Orders in the flagged fifteen-minute placement bucket; these are their current outcomes.",
              )
            }
            className="flex w-full min-w-0 items-start justify-between gap-3 rounded-md py-3 text-left hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 space-y-1 text-xs">
              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                <Network
                  chainId={cluster.chainId}
                  variant="inline"
                  showChainId={false}
                />
                <span aria-hidden>·</span>
                <span>{formatOrderDate(cluster.start)}</span>
              </span>
              <code className="block break-all text-[11px] text-muted-foreground">
                {cluster.adapter}
              </code>
              <span className="block text-muted-foreground">
                {kind === "bursts"
                  ? `${cluster.orders.length} orders / 5 min · preceding-hour average ${(cluster.baseline ?? 0).toFixed(1)} / 5 min`
                  : `${cluster.failed} of ${cluster.orders.length} orders currently failed / 15 min`}
              </span>
            </span>
            <ChevronRight aria-hidden className="mt-1 size-4 shrink-0" />
          </Button>
        ))}
      </div>
      {clusters.length > limit && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLimit(limit + 10)}
        >
          Show more groups
        </Button>
      )}
    </Panel>
  );
}

function useSecurityReview() {
  const { orders, updatedAt, config } = useOperationsData();
  return useMemo(
    () => buildSecurityReview(orders, updatedAt, config),
    [orders, updatedAt, config],
  );
}

function SecurityFindings() {
  const search = useSearchParams();
  const {
    orders,
    updatedAt,
    configUpdatedAt,
    isConfigError,
    error,
    inspectOrders,
  } = useOperationsData();
  const review = useSecurityReview();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const stale = now - updatedAt > 5 * 60_000;
  const incomplete =
    stale ||
    Boolean(error) ||
    isConfigError ||
    !review.currentRegistrySize ||
    now - configUpdatedAt > 65 * 60_000 ||
    review.missingNetwork.length > 0 ||
    review.missingTime.length > 0 ||
    review.baselineSkipped > 0 ||
    review.findings.some((finding) => !finding.available);
  const canVerify = orders.length > 0 && !incomplete;
  return (
    <div className="space-y-4">
      <section
        aria-label="Security review status"
        className="flex items-start gap-3 rounded-xl bg-card p-4"
      >
        {review.flagged.length || !canVerify ? (
          <CircleAlert
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-warning"
          />
        ) : (
          <CheckCircle2
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-success"
          />
        )}
        <div className="min-w-0 space-y-2">
          <h2 className="font-semibold">
            {!orders.length
              ? "No orders to assess"
              : review.flagged.length
                ? "Review needed"
                : incomplete
                  ? "Coverage incomplete"
                  : `No issues found in these ${review.findings.length} checks`}
          </h2>
          {review.flagged.length > 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {review.flagged.length.toLocaleString()} orders match one or more
              review rules.
            </p>
          )}
          {/* The page header already shows freshness; only warn when it matters. */}
          {stale && (
            <p className="text-xs text-warning">
              Snapshot from {formatOrderDate(updatedAt)} is over 5 minutes old;
              refresh before relying on these results.
            </p>
          )}
        </div>
      </section>
      <Panel
        title="What needs attention"
        description="Address checks cover all selected orders. Activity rules check placement buckets in the last 24 hours and use each order’s latest reported outcome."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={globalScopeHref("/adapters", search.toString())}>
              View adapters
            </Link>
          </Button>
        }
      >
        {!orders.length ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border">
            {review.findings.map((finding) => (
              <div
                key={finding.key}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 basis-56 items-center gap-1.5">
                  <h3 className="text-sm font-medium">{finding.label}</h3>
                  <InfoHint>{finding.description}</InfoHint>
                </div>
                {finding.orders.length ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      inspectOrders(
                        finding.label,
                        finding.orders,
                        finding.description,
                      )
                    }
                  >
                    Review {finding.orders.length.toLocaleString()} orders
                  </Button>
                ) : (
                  <Badge
                    variant="outline"
                    className={`min-h-8 max-w-full whitespace-normal gap-1.5 px-2.5 text-left ${
                      canVerify && finding.available
                        ? "border-transparent bg-success/10 text-success"
                        : "text-muted-foreground"
                    }`}
                  >
                    {canVerify && finding.available ? (
                      <>
                        <CheckCircle2 aria-hidden />
                        No issues
                      </>
                    ) : stale || error ? (
                      "Refresh needed"
                    ) : (
                      "Needs data"
                    )}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SecurityActivity() {
  const review = useSecurityReview();
  return (
    <div className="space-y-4">
      {!review.bursts.length && !review.failures.length ? (
        <EmptyState
          title="No activity groups flagged"
          description="No order bursts or repeated failure groups matched the loaded snapshot. See Findings for data coverage."
        />
      ) : null}
      <ClusterList
        title="Order bursts to review"
        clusters={review.bursts}
        kind="bursts"
      />
      <ClusterList
        title="Failure groups to review"
        clusters={review.failures}
        kind="failures"
      />
    </div>
  );
}

function SecurityCoverage({
  dashboardAccess,
}: {
  dashboardAccess: DashboardAccess;
}) {
  const { configUpdatedAt, isConfigError, scope } = useOperationsData();
  const review = useSecurityReview();
  return (
    <Panel
      title="Protection & coverage"
      description="Findings are review signals from the loaded snapshot, not attack verdicts. This page does not monitor network traffic, signatures, bytecode or fund transfers, and it does not alert in the background. Full addresses (recipient, executor, swapper) are on each order's detail page."
    >
      {/* Facts as rows; the standing caveats live in the section tooltip. */}
      <dl className="divide-y divide-border text-sm">
        {[
          {
            label: "Dashboard access",
            value:
              dashboardAccess === "disabled"
                ? "Google sign-in disabled"
                : dashboardAccess === "local"
                  ? "Local development bypass"
                  : "Google staff sign-in",
            warn: dashboardAccess !== "google",
          },
          {
            label: "Adapter configuration",
            value: review.currentRegistrySize
              ? `${review.currentRegistrySize.toLocaleString()} valid current-catalog adapter/network entries; excludes legacy, invalid, and observed-only addresses · retrieved ${formatOrderDate(configUpdatedAt)}${isConfigError ? " · refresh failed, may be cached" : ""}`
              : "Unavailable",
            warn: !review.currentRegistrySize || isConfigError,
          },
          {
            label: "Burst checks skipped for short history",
            value: review.baselineSkipped.toLocaleString(),
            warn: false,
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd
              className={`tabular-nums ${row.warn ? "font-medium text-warning" : ""}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {scope.days && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => scope.setPeriod("all")}
        >
          Review all history
        </Button>
      )}
    </Panel>
  );
}

export function SecurityView({
  dashboardAccess,
}: {
  dashboardAccess: DashboardAccess;
}) {
  return (
    <ViewTabs
      label="Security check views"
      param="security_view"
      aliases={{ activity: "findings" }}
      tabs={[
        {
          value: "health",
          label: "Service health",
          content: <SystemHealth view="monitoring" />,
        },
        {
          value: "findings",
          label: "Findings",
          content: (
            <HistoryBoundary>
              <SecurityFindings />
              <details className="rounded-xl bg-card p-4">
                <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Flagged activity groups
                </summary>
                <div className="mt-4">
                  <SecurityActivity />
                </div>
              </details>
            </HistoryBoundary>
          ),
        },
        {
          value: "coverage",
          label: "Coverage",
          content: (
            <HistoryBoundary>
              <SecurityCoverage dashboardAccess={dashboardAccess} />
            </HistoryBoundary>
          ),
        },
      ]}
    />
  );
}
