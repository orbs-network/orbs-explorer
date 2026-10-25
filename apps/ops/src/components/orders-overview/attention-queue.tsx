"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleHelp, Check } from "lucide-react";
import { useOperationsData } from "@/components/operations/operations-view";
import { Button } from "@orbs/ui/controls/button";
import { Panel } from "@/components/operations/primitives";
import { useSystemHealth } from "@/hooks/use-system-health";
import { summarizeSystemCoverage } from "@/lib/system-health";
import {
  buildOrderAttention,
  buildActiveOrderAttention,
  attentionOrdersHref,
  attentionOrderContext,
} from "@/lib/attention-queue";
import { snapshotFreshness } from "@/lib/overview-freshness";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { hasExecutionErrors } from "@/lib/order-diagnostics";
import { MonitoringRulesEditor, useMonitoringRules } from "./monitoring-rules";
import { useOperationalScope } from "@/hooks/use-operational-scope";
import { OperationalScopeControl } from "@/components/operations/operational-scope-control";

export function AttentionQueue() {
  const data = useOperationsData();
  const operational = useOperationalScope(data, data.scope);
  const current = operational.data;
  const health = useSystemHealth();
  const { rules, saveRules } = useMonitoringRules();
  const attention = useMemo(
    () =>
      buildOrderAttention(
        {
          orders: current.orders,
          partnerCards: current.partnerCards,
          snapshot: data.updatedAt,
          rules,
          lastOrderByPartner: data.lastOrderByPartner,
          activityPartners: data.activityPartners,
        },
        operational.navigation,
      ),
    [
      current.orders,
      current.partnerCards,
      data.updatedAt,
      rules,
      data.lastOrderByPartner,
      data.activityPartners,
      operational.navigation,
    ],
  );
  const monitoringSearch = new URLSearchParams(
    attentionOrdersHref(data.scope).split("?")[1],
  );
  monitoringSearch.set("security_view", "health");
  const monitoringHref = `/security?${monitoringSearch}`;
  const serviceIssues = health.services.flatMap<{
    id: string;
    title: string;
    detail: string;
    severity: "warning" | "unknown";
  }>((service) => {
    if (service.isPending)
      return [
        {
          id: `${service.id}-loading`,
          title: `${service.label} · checking telemetry`,
          detail: "Service and worker checks are loading.",
          severity: "unknown" as const,
        },
      ];
    const coverage = summarizeSystemCoverage(
      service.snapshot,
      service.assessment,
      service.isError,
    );
    const issues = [];
    if (service.isError)
      issues.push({
        id: `${service.id}-probe`,
        title: `${service.label} · API check failed`,
        detail:
          "The latest request failed. Last successful signals, if available, are retained for comparison; current reachability is unknown.",
        severity: "warning" as const,
      });
    const workerIssues = [
      ...(service.assessment?.listeners ?? []),
      ...(service.assessment?.takers ?? []),
    ].filter(
      (signal) => signal.state === "inactive" || signal.state === "overdue",
    ).length;
    if (!service.isError && workerIssues > 0)
      issues.push({
        id: `${service.id}-workers`,
        title: `${service.label} · ${workerIssues} worker ${workerIssues === 1 ? "signal needs" : "signals need"} review`,
        detail:
          "Reported inactive or overdue workers; inspect heartbeat criteria and potentially exposed orders.",
        severity: "warning" as const,
      });
    if (coverage.state !== "complete")
      issues.push({
        id: `${service.id}-coverage`,
        title: `${service.label} · ${coverage.label.toLowerCase()}`,
        detail:
          coverage.missing.join(" · ") ||
          "Worker coverage cannot currently establish processing health.",
        severity: "unknown" as const,
      });
    return issues;
  });
  const orderIssues = data.isLoading || data.isError ? [] : attention.issues;
  const stale =
    data.updatedAt > 0 &&
    snapshotFreshness({
      updatedAt: data.updatedAt,
      now: health.evaluatedAt,
      refreshing: data.isRefreshing,
      failed: data.isRefreshError,
    }).stale;
  const recovered = data.orders.filter(
    (order) =>
      getOverviewOrderStatus(order) === "completed" &&
      hasExecutionErrors(order),
  ).length;
  const anyIssues = orderIssues.length + serviceIssues.length > 0;
  const activeReview = useMemo(
    () => [
      ...new Set(
        buildActiveOrderAttention(
          current.orders,
          data.updatedAt,
          operational.navigation,
        ).flatMap((issue) => issue.orders),
      ),
    ],
    [current.orders, data.updatedAt, operational.navigation],
  );
  const reviewSearch = new URLSearchParams(
    attentionOrdersHref(data.scope).split("?")[1],
  );
  reviewSearch.set("active_scope", operational.placement);
  const scopeNote =
    operational.placement === "all"
      ? "All placement dates · selected networks and trading apps"
      : `Placed in ${data.scope.period === "all" ? "all available history" : `the last ${data.scope.period} days`} · selected networks and trading apps`;

  return (
    <Panel
      title={
        data.isLoading
          ? "Needs attention · checking orders…"
          : data.isError || stale
            ? "Needs attention · fresh snapshot required"
            : activeReview.length
              ? `Needs attention · ${activeReview.length} active orders to review`
              : "No active order review signals"
      }
      className="[&>div:first-child]:mb-2"
      description="Current review signals and coverage gaps. Counts can overlap; a failed execution attempt is not a terminal order failure. Rate rules use orders placed in the selected window."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {!data.isLoading &&
            !data.isError &&
            !stale &&
            activeReview.length > 0 && (
              <Button asChild size="sm">
                <Link href={`/health?${reviewSearch}`}>
                  Review {activeReview.length} orders
                  <ChevronRight aria-hidden className="size-3.5" />
                </Link>
              </Button>
            )}
          <MonitoringRulesEditor
            rules={rules}
            onSave={saveRules}
            partnerOptions={data.partnerOptions}
          />
        </div>
      }
    >
      <p className="text-xs text-muted-foreground">{scopeNote}</p>
      {serviceIssues.length > 0 && (
        <Link
          href={monitoringHref}
          className="mt-2 inline-flex min-h-8 items-center gap-1 rounded-sm text-xs text-amber-800 hover:underline focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-300"
        >
          <AlertTriangle aria-hidden className="size-3.5" />
          {serviceIssues.length} service{" "}
          {serviceIssues.length === 1 ? "check needs" : "checks need"} review ·
          coverage may be incomplete
          <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      )}
      <details className="mt-2">
        <summary className="w-fit cursor-pointer rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Review details & coverage
        </summary>
        <div className="mt-4">
          <div className="mb-3">
            <OperationalScopeControl
              {...operational}
              period={data.scope.period}
              isLoading={data.isLoading}
              isUnavailable={data.isError}
            />
          </div>
          {data.isLoading && (
            <p role="status" className="mb-3 text-xs text-muted-foreground">
              Loading order review signals… Service checks are independent.
            </p>
          )}
          {(data.isError || stale) && (
            <Link
              prefetch={false}
              href={attentionOrdersHref(data.scope)}
              className="mb-3 block rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300"
            >
              {data.isError
                ? "Order signals unavailable: complete history could not be loaded."
                : "Order snapshot is stale: current execution health is unknown."}{" "}
              Open Orders to review or retry.
            </Link>
          )}
          {!anyIssues && !data.isLoading && !data.isError && !stale && (
            <p role="status" className="flex items-center gap-2 py-2 text-sm">
              <Check aria-hidden className="size-4" />
              No actionable issues detected under current rules.
            </p>
          )}
          <div className="grid gap-x-6 md:grid-cols-2">
            {(["warning", "unknown"] as const).map((severity) => {
              const orders = orderIssues.filter(
                (issue) => issue.severity === severity,
              );
              const services = serviceIssues.filter(
                (issue) => issue.severity === severity,
              );
              if (!orders.length && !services.length) return null;
              const Icon = severity === "warning" ? AlertTriangle : CircleHelp;
              return (
                <section
                  key={severity}
                  aria-label={
                    severity === "warning"
                      ? "Review signals"
                      : "Unknown coverage"
                  }
                >
                  <h3 className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                    <Icon
                      aria-hidden
                      className={`size-3.5 ${severity === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
                    />
                    {severity === "warning" ? "Review" : "Unknown"}
                  </h3>
                  <ul className="divide-y divide-border/60">
                    {orders.map((issue) => {
                      const context = attentionOrderContext(
                        issue.orders,
                        current.partnerCards,
                      );
                      return (
                        <li key={issue.id}>
                          <Link
                            prefetch={false}
                            href={issue.href}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-md py-2.5 text-xs hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="min-w-0">
                              <span className="block font-medium">
                                {issue.title}
                              </span>
                              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                                {issue.detail}
                              </span>
                              {context.networkCount > 0 && (
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                  {context.partnerNames.slice(0, 2).join(", ")}
                                  {context.partnerNames.length > 2
                                    ? ` +${context.partnerNames.length - 2}`
                                    : ""}
                                  {context.partnerNames.length > 0 ? " · " : ""}
                                  {context.networkCount}{" "}
                                  {context.networkCount === 1
                                    ? "network"
                                    : "networks"}
                                  {context.latestPlaced
                                    ? ` · Latest placement ${new Date(context.latestPlaced).toLocaleString(undefined, { timeZone: "UTC", hour12: false })} UTC`
                                    : ""}
                                </span>
                              )}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                              {issue.count}{" "}
                              {issue.unit === "app"
                                ? "app"
                                : issue.count === 1
                                  ? "order"
                                  : "orders"}
                              <ChevronRight aria-hidden className="size-3" />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                    {services.map((issue) => (
                      <li key={issue.id}>
                        <Link
                          prefetch={false}
                          href={monitoringHref}
                          className="flex items-center justify-between gap-3 rounded-md py-2.5 text-xs hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span>
                            <span className="block font-medium">
                              {issue.title}
                            </span>
                            <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
                              {issue.detail}
                            </span>
                          </span>
                          <ChevronRight
                            aria-hidden
                            className="size-3 shrink-0"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          {recovered > 0 && (
            <div className="mt-3 border-t border-border pt-3 text-[11px]">
              <Link
                prefetch={false}
                href={attentionOrdersHref(data.scope, {
                  order_status: "completed",
                  order_errors: "recovered",
                })}
                className="rounded text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {recovered} completed after execution errors in reporting period
              </Link>
            </div>
          )}
        </div>
      </details>
    </Panel>
  );
}
