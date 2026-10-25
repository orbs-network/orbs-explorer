"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@orbs/ui/controls/badge";
import { Button } from "@orbs/ui/controls/button";
import { Network } from "@orbs/ui/controls/network";
import { ViewTabs } from "@/components/view-tabs";
import {
  useSystemHealth,
  type SystemHealthService,
} from "@/hooks/use-system-health";
import {
  formatHealthAge,
  buildServiceOrderImpact,
  serviceOrdersHref,
  summarizeHealthCoverage,
  summarizeSystemCoverage,
  type HealthSignalState,
} from "@/lib/system-health";
import { Panel, TableFrame } from "./primitives";
import { useOperationsData } from "./operations-view";
import { globalScopeHref } from "@/lib/partner-navigation";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { useOperationalScope } from "@/hooks/use-operational-scope";
import { OperationalScopeControl } from "./operational-scope-control";

function ExactTime({ value }: { value: number }) {
  if (!Number.isFinite(value) || value <= 0) return <>Unreported</>;
  return (
    <time
      dateTime={new Date(value).toISOString()}
      title={new Date(value).toISOString()}
    >
      {new Date(value).toLocaleString(undefined, {
        hour12: false,
        timeZoneName: "short",
      })}
    </time>
  );
}

function CoverageSummary({ service }: { service: SystemHealthService }) {
  const coverage = summarizeSystemCoverage(
    service.snapshot,
    service.assessment,
    service.isError,
  );
  return (
    <p
      className={`text-[11px] ${coverage.state === "partial" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
      title={
        coverage.missing.join(". ") ||
        "The fresh response includes listener and taker signals. This does not verify order execution."
      }
    >
      {coverage.label}
    </p>
  );
}

const signalLabels: Record<HealthSignalState, string> = {
  active: "Active (reported)",
  inactive: "Inactive",
  disabled: "Disabled",
  overdue: "Update overdue",
  unknown: "Unreported",
};

function SignalBadge({
  state,
  cached = false,
  taker = false,
}: {
  state: HealthSignalState;
  cached?: boolean;
  taker?: boolean;
}) {
  const issue = !cached && (state === "inactive" || state === "overdue");
  const active = !cached && state === "active";
  const Icon = active ? CheckCircle2 : issue ? AlertTriangle : CircleHelp;
  const label =
    taker && state === "active"
      ? "Within threshold"
      : taker && state === "overdue"
        ? "Heartbeat overdue"
        : signalLabels[state];
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "text-success"
          : issue
            ? "text-amber-700 dark:text-amber-400"
            : "text-muted-foreground"
      }
    >
      <Icon aria-hidden />
      {cached ? `Cached: ${label}` : label}
    </Badge>
  );
}

function ServiceBadge({ service }: { service: SystemHealthService }) {
  const size = "px-1.5 text-[10px] [&>svg]:size-2.5";
  if (service.isPending && !service.isError) {
    return (
      <Badge variant="outline" className={size}>
        <Loader2
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
        Checking API
      </Badge>
    );
  }
  if (service.isError) {
    return (
      <Badge
        variant="outline"
        className={`${size} text-amber-700 dark:text-amber-400`}
      >
        <AlertTriangle aria-hidden />
        API check failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`${size} text-success`}>
      <CheckCircle2 aria-hidden />
      API reachable
    </Badge>
  );
}

function CompactServiceSummary({ service }: { service: SystemHealthService }) {
  const snapshot = service.snapshot;
  const assessment = service.assessment;
  const reportAge =
    snapshot?.reportedAt === undefined
      ? undefined
      : snapshot.checkedAt + (service.checkedAgeMs ?? 0) - snapshot.reportedAt;
  return (
    <div className="min-w-0 space-y-1 rounded-lg bg-muted/40 p-2">
      <p className="text-[11px] font-medium">{service.label}</p>
      <ServiceBadge service={service} />
      <CoverageSummary service={service} />
      {snapshot && (
        <p className="text-[10px] text-muted-foreground">
          {service.isError ? "Last success " : "Checked "}
          <time
            dateTime={new Date(snapshot.checkedAt).toISOString()}
            title={new Date(snapshot.checkedAt).toLocaleString()}
          >
            {new Date(snapshot.checkedAt).toLocaleTimeString(undefined, {
              hour12: false,
              timeZoneName: "short",
            })}
          </time>
          {!service.isError && ` · ${Math.round(snapshot.latencyMs)} ms`}
        </p>
      )}
      {snapshot && (
        <p
          className={`text-[10px] ${assessment?.freshness === "stale" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
        >
          {assessment?.freshness === "unknown"
            ? snapshot.reportedAt === undefined
              ? "Report time unreported"
              : "Report time unknown"
            : `${assessment?.freshness === "stale" ? "Report stale" : "Report"} · ${formatHealthAge(reportAge)} old`}
        </p>
      )}
      <dl className="space-y-1 border-t border-border pt-1.5 text-[10px]">
        {(["listener", "taker"] as const).map((kind) => {
          const coverage =
            snapshot && assessment
              ? summarizeHealthCoverage(snapshot, assessment, kind)
              : undefined;
          return (
            <div key={kind}>
              <dt className="font-medium text-muted-foreground">
                {kind === "listener" ? "Listeners" : "Taker heartbeats"}
              </dt>
              <dd
                className={
                  !service.isError && coverage?.needsReview
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
                }
              >
                {service.isError && snapshot ? "Cached: " : ""}
                {coverage?.label ??
                  (service.isError ? "Unavailable" : "Checking…")}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function ServiceSummary({ service }: { service: SystemHealthService }) {
  const snapshot = service.snapshot;
  const coverage = summarizeSystemCoverage(
    snapshot,
    service.assessment,
    service.isError,
  );
  return (
    <div className="min-w-0 space-y-2 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium">{service.label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ServiceBadge service={service} />
        <CoverageSummary service={service} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {service.isError
          ? service.error?.message || "Status could not be checked."
          : snapshot
            ? `${Math.round(snapshot.latencyMs)} ms response time`
            : "Requesting the service status endpoint…"}
      </p>
      {snapshot && (
        <p className="text-xs text-muted-foreground">
          Last successful response: <ExactTime value={snapshot.checkedAt} />
        </p>
      )}
      {snapshot?.reportedAt && (
        <p className="text-xs text-muted-foreground">
          Worker report as of: <ExactTime value={snapshot.reportedAt} />
        </p>
      )}
      {service.isError && service.errorUpdatedAt > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Failed probe: <ExactTime value={service.errorUpdatedAt} />. Last
          {snapshot
            ? " successful sample retained above."
            : " successful response is not available in this session."}
        </p>
      )}
      {service.snapshot &&
        service.assessment &&
        coverage.missing.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {coverage.missing.join(". ")}.
          </p>
        )}
      {snapshot && (
        <details className="text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-sm py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Service version
          </summary>
          <p className="mt-1 break-all font-mono text-[11px]">
            {snapshot.version || "Version unreported"}
          </p>
        </details>
      )}
    </div>
  );
}

function CoverageNote({
  service,
  kind,
}: {
  service: SystemHealthService;
  kind: "listener" | "taker";
}) {
  if (!service.snapshot) {
    return (
      <p className="text-xs text-muted-foreground">
        {service.isError ? "Status unavailable." : "Checking service…"}
      </p>
    );
  }
  const coverage =
    kind === "listener"
      ? service.snapshot.listenerCoverage
      : service.snapshot.takerCoverage;
  const invalid =
    kind === "listener"
      ? service.snapshot.invalidListenerCount
      : service.snapshot.invalidTakerCount;
  const empty =
    kind === "listener"
      ? !service.snapshot.listeners.length
      : !service.snapshot.takers.length;
  const notes = [
    ...(service.isError
      ? ["Refresh failed. Values below are from the last successful response."]
      : []),
    ...(service.assessment?.freshness === "stale"
      ? [
          "The service report is over 3 minutes old. Current signal state is unknown.",
        ]
      : []),
    ...(service.assessment?.freshness === "unknown"
      ? [
          "Report timestamp is missing or invalid; current signal state is unknown.",
        ]
      : []),
    ...(coverage === "unreported"
      ? [
          `This service does not report ${kind === "listener" ? "listener signals" : "taker heartbeats"}.`,
        ]
      : []),
    ...(coverage === "invalid"
      ? [`The service returned an unexpected ${kind} report format.`]
      : []),
    ...(coverage === "reported" && empty
      ? [
          `No ${kind === "listener" ? "listeners" : "taker heartbeats"} were reported.`,
        ]
      : []),
    ...(invalid
      ? [
          `${invalid} malformed ${kind} ${invalid === 1 ? "signal was" : "signals were"} omitted.`,
        ]
      : []),
  ];
  return notes.length ? (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {notes.join(" ")}
    </p>
  ) : null;
}

function ListenerDetails({ services }: { services: SystemHealthService[] }) {
  const reporting = useOperationsData();
  const operational = useOperationalScope(reporting, reporting.scope);
  const { orders, isLoading, isError } = operational.data;
  const { scope } = operational;
  return (
    <div className="space-y-4">
      <OperationalScopeControl
        {...operational}
        period={reporting.scope.period}
        isLoading={isLoading}
        isUnavailable={isError}
      />
      {services.map((service) => (
        <div key={service.id} className="min-w-0 space-y-2">
          <h3 className="text-xs font-medium">{service.label}</h3>
          <CoverageNote service={service} kind="listener" />
          {!!service.assessment?.listeners.length && (
            <TableFrame label={`${service.label} listener signals`}>
              <thead>
                <tr>
                  <th scope="col">Network</th>
                  <th scope="col">Listener</th>
                  <th scope="col">Last block</th>
                  <th scope="col">Update age</th>
                  <th scope="col">Currently active orders</th>
                </tr>
              </thead>
              <tbody>
                {service.assessment.listeners.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <Network
                        chainId={row.chainId}
                        data={{ name: row.chainName }}
                        variant="inline"
                        showChainId={false}
                      />
                      {row.chainId !== undefined && (
                        <span className="ml-1 text-muted-foreground">
                          ({row.chainId})
                        </span>
                      )}
                    </td>
                    <td>
                      <SignalBadge state={row.state} cached={service.isError} />
                    </td>
                    <td>{row.lastBlock?.toLocaleString() ?? "Unreported"}</td>
                    <td
                      title={
                        row.updatedAt
                          ? new Date(row.updatedAt).toLocaleString()
                          : undefined
                      }
                    >
                      {formatHealthAge(row.ageMs)}
                    </td>
                    <td>
                      {isLoading ? (
                        "Loading orders…"
                      ) : isError ? (
                        "Orders unavailable"
                      ) : row.chainId === undefined ? (
                        "Network unknown"
                      ) : scope.chainIds.length &&
                        !scope.chainIds.includes(String(row.chainId)) ? (
                        "Outside network selection"
                      ) : (
                        <Link
                          className="rounded text-link hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          href={serviceOrdersHref(scope.query, service.id, {
                            chainId: row.chainId,
                            status: "active",
                          })}
                        >
                          {
                            orders.filter(
                              (order) =>
                                order.source === service.id &&
                                getTwapOrderChainId(order) === row.chainId &&
                                getOverviewOrderStatus(order) === "active",
                            ).length
                          }{" "}
                          active
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          )}
        </div>
      ))}
    </div>
  );
}

function TakerDetails({ services }: { services: SystemHealthService[] }) {
  return (
    <div className="space-y-4">
      {services.map((service) => (
        <div key={service.id} className="min-w-0 space-y-2">
          <h3 className="text-xs font-medium">{service.label}</h3>
          <CoverageNote service={service} kind="taker" />
          {!!service.assessment?.takers.length && (
            <TableFrame label={`${service.label} taker heartbeats`}>
              <thead>
                <tr>
                  <th scope="col">Taker server</th>
                  <th scope="col">Heartbeat</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Avg. interval</th>
                  <th scope="col">Review after</th>
                </tr>
              </thead>
              <tbody>
                {service.assessment.takers.map((row) => (
                  <tr key={row.key}>
                    <td className="max-w-64 break-all font-mono">
                      {row.serverId ?? "Server unreported"}
                    </td>
                    <td>
                      <SignalBadge
                        state={row.state}
                        cached={service.isError}
                        taker
                      />
                    </td>
                    <td
                      title={
                        row.lastFetchAt
                          ? new Date(row.lastFetchAt).toLocaleString()
                          : undefined
                      }
                    >
                      {row.ageMs === undefined
                        ? "Unreported"
                        : `${formatHealthAge(row.ageMs)} ago`}
                    </td>
                    <td>
                      {row.averageIntervalMs && row.averageIntervalMs > 0
                        ? `${(row.averageIntervalMs / 1000).toFixed(1)}s`
                        : "Unreported"}
                    </td>
                    <td>{formatHealthAge(row.overdueAfterMs)}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
          )}
        </div>
      ))}
    </div>
  );
}

function ServiceOrderImpact({ services }: { services: SystemHealthService[] }) {
  const reporting = useOperationsData();
  const operational = useOperationalScope(reporting, reporting.scope);
  const { orders, updatedAt, isRefreshError, isLoading, isError, retry } =
    operational.data;
  const { scope } = operational;
  if (isLoading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading order exposure… API and worker checks remain available.
      </p>
    );
  if (isError)
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>
          Order exposure is unavailable because complete history could not be
          loaded. API and worker checks remain available.
        </p>
        <Button variant="outline" size="sm" onClick={retry}>
          Retry order history
        </Button>
      </div>
    );
  return (
    <div className="space-y-3">
      <OperationalScopeControl
        {...operational}
        period={reporting.scope.period}
      />
      <p className="text-xs text-muted-foreground">
        Current active exposure uses the open-order scope above. Ended outcomes
        use the reporting placement period. App and network filters apply to
        both · order snapshot <ExactTime value={updatedAt} />. These are orders
        on each service, not proof that a worker issue caused an order failure.
        {isRefreshError ? " Order refresh failed; counts are cached." : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const impact = buildServiceOrderImpact(orders, service.id, updatedAt);
          const reported = buildServiceOrderImpact(
            reporting.orders,
            service.id,
            updatedAt,
          );
          return (
            <section
              key={service.id}
              className="min-w-0 space-y-2 rounded-lg bg-muted/40 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-medium">{service.label}</h3>
                <Link
                  href={serviceOrdersHref(reporting.scope.query, service.id)}
                  className="rounded text-xs text-link hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {reported.orders.length} placed in reporting period
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                {[
                  {
                    label: "active",
                    count: impact.active.length,
                    filters: { status: "active" },
                    query: scope.query,
                  },
                  {
                    label: "active past deadline",
                    count: impact.overdue.length,
                    filters: { status: "active", deadline: "past" as const },
                    query: scope.query,
                  },
                  {
                    label: "terminal failures in reporting period",
                    count: reported.failed.length,
                    filters: { status: "failed" },
                    query: reporting.scope.query,
                  },
                  {
                    label: "active · latest attempt failed",
                    count: impact.latestErrors.filter(
                      (order) => getOverviewOrderStatus(order) === "active",
                    ).length,
                    filters: { status: "active", errors: "latest" },
                    query: scope.query,
                  },
                  {
                    label: "completed after errors in reporting period",
                    count: reported.recovered.length,
                    filters: { errors: "recovered" },
                    query: reporting.scope.query,
                  },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={serviceOrdersHref(
                      item.query,
                      service.id,
                      item.filters,
                    )}
                    className="rounded text-link underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.count} {item.label}
                  </Link>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {impact.oldestActivePlacedAt ? (
                  <>
                    Oldest active placement:{" "}
                    <ExactTime value={impact.oldestActivePlacedAt} />. Age alone
                    does not establish a stall.
                  </>
                ) : (
                  "No dated active orders in this cohort."
                )}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Lightweight global status: independent of historical orders and page filters. */
export function SystemHealth({
  view = "snapshot",
}: {
  view?: "snapshot" | "monitoring";
}) {
  const { services, isRefreshing, refresh, evaluatedAt } = useSystemHealth();
  const hasEvaluation = services.some(
    (service) => service.snapshot || service.isError,
  );
  const search = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  return (
    <Panel
      title="API & service health"
      action={
        <Button
          variant="outline"
          size="icon"
          className="size-7"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          aria-label="Refresh API and service health"
          title="Refresh API and service health"
        >
          <RefreshCw
            aria-hidden
            className={
              isRefreshing ? "animate-spin motion-reduce:animate-none" : ""
            }
          />
        </Button>
      }
    >
      <div className="space-y-2">
        {view === "snapshot" && (
          <div className="grid min-w-0 grid-cols-2 gap-2">
            {services.map((service) => (
              <CompactServiceSummary key={service.id} service={service} />
            ))}
          </div>
        )}
        {/* On the monitoring page this row only carries the loading notice. */}
        {(view !== "monitoring" || !hasEvaluation) && (
          <div className="flex flex-wrap items-center justify-between gap-1">
            {view === "monitoring" ? (
              <span className="text-[11px] text-muted-foreground">
                Checking service signals…
              </span>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 text-xs"
                  onClick={() => setExpanded(!expanded)}
                  aria-expanded={expanded}
                  aria-controls={detailsId}
                >
                  <ChevronDown
                    aria-hidden
                    className={expanded ? "rotate-180" : ""}
                  />
                  {expanded ? "Hide details" : "Service details"}
                </Button>
                <Link
                  className="rounded text-[11px] text-link hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  href={globalScopeHref("/security", search.toString())}
                >
                  Monitoring details
                </Link>
                <span
                  className="text-[10px] text-muted-foreground"
                  title={
                    hasEvaluation
                      ? `Evaluated ${new Date(evaluatedAt).toISOString()}`
                      : undefined
                  }
                >
                  Global signals · refresh 1m
                </span>
              </>
            )}
          </div>
        )}
        {(view === "monitoring" || expanded) && (
          <div
            id={detailsId}
            className={
              view === "monitoring" ? undefined : "border-t border-border pt-3"
            }
          >
            <ViewTabs
              label="API and service details"
              param="health_view"
              tabs={[
                {
                  value: "services",
                  label: "API details",
                  content: (
                    <div className="space-y-3">
                      <details className="text-xs text-muted-foreground">
                        <summary className="w-fit cursor-pointer rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          Health check thresholds
                        </summary>
                        <p className="mt-2 max-w-3xl text-[11px] leading-relaxed">
                          Rules: API probe timeout 10s; service report and
                          listener update stale after 3m; taker heartbeat
                          overdue after max(60s, 3× reported average). Order
                          deadlines are the reported contract deadlines, not a
                          processing SLA. Missing telemetry stays unknown.
                        </p>
                      </details>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                        {services.map((service) => (
                          <ServiceSummary key={service.id} service={service} />
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  value: "listeners",
                  label: "Listeners",
                  content: <ListenerDetails services={services} />,
                },
                {
                  value: "takers",
                  label: "Takers",
                  content: <TakerDetails services={services} />,
                },
                ...(view === "monitoring"
                  ? [
                      {
                        value: "orders",
                        label: "Order exposure",
                        content: <ServiceOrderImpact services={services} />,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}
