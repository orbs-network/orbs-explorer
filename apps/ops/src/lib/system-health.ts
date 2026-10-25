import type { ServiceStatusResponse } from "@orbs/domain/twap/service-status";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { hasExecutionErrors, hasLastExecutionError } from "./order-diagnostics";
import { globalScopeHref } from "./partner-navigation";

export const HEALTH_REPORT_MAX_AGE_MS = 3 * 60_000;
export const TAKER_MIN_OVERDUE_MS = 60_000;
export const TAKER_INTERVAL_MULTIPLIER = 3;
export const HEALTH_REFRESH_INTERVAL_MS = 60_000;

type ReportCoverage = "reported" | "unreported" | "invalid";
export type HealthSignalState =
  | "active"
  | "inactive"
  | "disabled"
  | "overdue"
  | "unknown";

export type ListenerSignal = {
  key: string;
  chainId?: number;
  chainName?: string;
  listenerActive?: boolean;
  eventsFetchingEnabled?: boolean;
  lastBlock?: number;
  updatedAt?: number;
};

export type TakerSignal = {
  key: string;
  serverId?: string;
  lastFetchAt?: number;
  secondsSinceLastFetch?: number;
  averageIntervalMs?: number;
};

export type SystemHealthSnapshot = {
  checkedAt: number;
  latencyMs: number;
  reportedAt?: number;
  version?: string;
  listeners: ListenerSignal[];
  listenerCoverage: ReportCoverage;
  takers: TakerSignal[];
  takerCoverage: ReportCoverage;
  invalidListenerCount: number;
  invalidTakerCount: number;
};

export type EvaluatedSignal<T> = T & {
  state: HealthSignalState;
  ageMs?: number;
  overdueAfterMs?: number;
};

export type SystemHealthAssessment = {
  freshness: "fresh" | "stale" | "unknown";
  listeners: EvaluatedSignal<ListenerSignal>[];
  takers: EvaluatedSignal<TakerSignal>[];
  issueCount: number;
  unknownCount: number;
  disabledCount: number;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nonnegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function integer(value: unknown): number | undefined {
  const number = nonnegative(value);
  return number !== undefined && Number.isSafeInteger(number)
    ? number
    : undefined;
}

function timestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function coverage(value: unknown): ReportCoverage {
  return value === undefined || value === null
    ? "unreported"
    : Array.isArray(value)
      ? "reported"
      : "invalid";
}

function chainIdentity(value: Record<string, unknown>, fallback: string) {
  const chainId = integer(value.chainId);
  const chainName = text(value.chainName);
  return {
    chainId,
    chainName,
    key: chainId !== undefined ? String(chainId) : chainName || fallback,
  };
}

/** Read only actual service signals. Catalog presence never implies an active listener. */
export function parseSystemHealth(
  response: ServiceStatusResponse,
): SystemHealthSnapshot {
  const payload = response.payload;
  const listeners = new Map<string, ListenerSignal>();
  const catalog = Array.isArray(payload.chains) ? payload.chains : [];
  for (const [index, value] of catalog.entries()) {
    const row = record(value);
    if (!row) continue;
    const identity = chainIdentity(row, `catalog-${index}`);
    listeners.set(identity.key, identity);
  }
  let invalidListenerCount = 0;
  const listenerRows = Array.isArray(payload.blockFetchStatus)
    ? payload.blockFetchStatus
    : [];
  for (const [index, value] of listenerRows.entries()) {
    const row = record(value);
    if (!row) {
      invalidListenerCount++;
      continue;
    }
    const identity = chainIdentity(row, `listener-${index}`);
    const previous = listeners.get(identity.key);
    listeners.set(identity.key, {
      ...previous,
      ...identity,
      chainName: identity.chainName ?? previous?.chainName,
      listenerActive: boolean(row.listenerActive),
      eventsFetchingEnabled: boolean(row.eventsFetchingEnabled),
      lastBlock: integer(row.lastBlock),
      updatedAt: timestamp(row.updatedAt),
    });
  }
  let invalidTakerCount = 0;
  const takerRows = Array.isArray(payload.takerFetchStats)
    ? payload.takerFetchStats
    : [];
  const takers = takerRows.flatMap((value, index): TakerSignal[] => {
    const row = record(value);
    if (!row) {
      invalidTakerCount++;
      return [];
    }
    const serverId = text(row.serverId);
    return [
      {
        key: `${serverId || "taker"}-${index}`,
        serverId,
        lastFetchAt: timestamp(row.lastFetchAt),
        secondsSinceLastFetch: nonnegative(row.secondsSinceLastFetch),
        averageIntervalMs: nonnegative(row.averageIntervalMs),
      },
    ];
  });
  return {
    checkedAt: response.checkedAt,
    latencyMs: response.latencyMs,
    reportedAt: timestamp(payload.timestamp),
    version: text(payload.version),
    listeners: [...listeners.values()],
    listenerCoverage: coverage(payload.blockFetchStatus),
    takers,
    takerCoverage: coverage(payload.takerFetchStats),
    invalidListenerCount,
    invalidTakerCount,
  };
}

function age(timestamp: number | undefined, now: number): number | undefined {
  // A future timestamp is unknown, not a reassuring zero-age heartbeat.
  return timestamp !== undefined && timestamp <= now + 5_000
    ? Math.max(0, now - timestamp)
    : undefined;
}

export function assessSystemHealth(
  snapshot: SystemHealthSnapshot,
  now: number,
): SystemHealthAssessment {
  const reportAge = age(snapshot.reportedAt, now);
  const freshness =
    reportAge === undefined
      ? "unknown"
      : reportAge > HEALTH_REPORT_MAX_AGE_MS
        ? "stale"
        : "fresh";
  const listeners = snapshot.listeners.map(
    (row): EvaluatedSignal<ListenerSignal> => {
      const ageMs = age(row.updatedAt, now);
      let state: HealthSignalState = "unknown";
      if (row.eventsFetchingEnabled === false) state = "disabled";
      else if (row.eventsFetchingEnabled === true && freshness === "fresh") {
        if (row.listenerActive === false) state = "inactive";
        else if (row.listenerActive === true && ageMs !== undefined) {
          state = ageMs > HEALTH_REPORT_MAX_AGE_MS ? "overdue" : "active";
        }
      }
      return { ...row, state, ageMs };
    },
  );
  const elapsedSinceCheck = Math.max(0, now - snapshot.checkedAt);
  const takers = snapshot.takers.map((row): EvaluatedSignal<TakerSignal> => {
    const timestampAge = age(row.lastFetchAt, now);
    // Prefer the older of the two reported signals when they disagree.
    const secondsAge =
      row.secondsSinceLastFetch === undefined
        ? undefined
        : row.secondsSinceLastFetch * 1000 + elapsedSinceCheck;
    const ageMs =
      timestampAge !== undefined && secondsAge !== undefined
        ? Math.max(timestampAge, secondsAge)
        : (timestampAge ?? secondsAge);
    const overdueAfterMs =
      row.averageIntervalMs !== undefined && row.averageIntervalMs > 0
        ? Math.max(
            TAKER_MIN_OVERDUE_MS,
            row.averageIntervalMs * TAKER_INTERVAL_MULTIPLIER,
          )
        : undefined;
    const invalidClock =
      row.lastFetchAt !== undefined && timestampAge === undefined;
    const state: HealthSignalState =
      freshness !== "fresh" ||
      invalidClock ||
      ageMs === undefined ||
      overdueAfterMs === undefined
        ? "unknown"
        : ageMs > overdueAfterMs
          ? "overdue"
          : "active";
    return { ...row, ageMs, overdueAfterMs, state };
  });
  const states = [...listeners, ...takers];
  const missingReports = Number(!listeners.length) + Number(!takers.length);
  return {
    freshness,
    listeners,
    takers,
    issueCount:
      Number(freshness === "stale") +
      states.filter(
        (row) => row.state === "inactive" || row.state === "overdue",
      ).length,
    unknownCount:
      states.filter((row) => row.state === "unknown").length +
      missingReports +
      snapshot.invalidListenerCount +
      snapshot.invalidTakerCount +
      Number(freshness === "unknown"),
    disabledCount: listeners.filter((row) => row.state === "disabled").length,
  };
}

export function formatHealthAge(ageMs: number | undefined): string {
  if (ageMs === undefined) return "Unreported";
  const seconds = Math.floor(Math.max(0, ageMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

/** Describe reported worker coverage without treating it as order/API health. */
export function summarizeHealthCoverage(
  snapshot: SystemHealthSnapshot,
  assessment: SystemHealthAssessment,
  kind: "listener" | "taker",
): { label: string; needsReview: boolean } {
  const coverage =
    kind === "listener" ? snapshot.listenerCoverage : snapshot.takerCoverage;
  if (coverage === "unreported")
    return { label: "Unreported", needsReview: false };
  if (coverage === "invalid")
    return { label: "Invalid report", needsReview: true };
  const rows = kind === "listener" ? assessment.listeners : assessment.takers;
  const invalid =
    kind === "listener"
      ? snapshot.invalidListenerCount
      : snapshot.invalidTakerCount;
  const labels: Record<HealthSignalState, string> = {
    active: kind === "listener" ? "active" : "within threshold",
    inactive: "inactive",
    overdue: "overdue",
    disabled: "disabled",
    unknown: "unknown",
  };
  const parts = (Object.keys(labels) as HealthSignalState[]).flatMap(
    (state) => {
      const count = rows.filter((row) => row.state === state).length;
      return count ? [`${count} ${labels[state]}`] : [];
    },
  );
  if (invalid) parts.push(`${invalid} malformed`);
  return {
    label: parts.length ? parts.join(" · ") : "None reported",
    needsReview:
      !!invalid ||
      rows.some((row) => row.state === "inactive" || row.state === "overdue"),
  };
}

/** Coverage describes the received telemetry, independently of worker health. */
export function summarizeSystemCoverage(
  snapshot?: SystemHealthSnapshot,
  assessment?: SystemHealthAssessment,
  unavailable = false,
): {
  state: "complete" | "partial" | "unknown";
  label: string;
  missing: string[];
} {
  if (!snapshot || !assessment || unavailable)
    return {
      state: "unknown",
      label: "Coverage unknown",
      missing: [
        unavailable
          ? "Current status response unavailable"
          : "Awaiting status response",
      ],
    };
  if (assessment.freshness !== "fresh")
    return {
      state: "unknown",
      label: "Coverage unknown",
      missing: [
        assessment.freshness === "stale"
          ? "Service report over 3 minutes old"
          : "Service report time unknown",
      ],
    };
  const missing: string[] = [];
  let known = 0;
  for (const kind of ["listener", "taker"] as const) {
    const label = kind === "listener" ? "Listener" : "Taker";
    const coverage =
      kind === "listener" ? snapshot.listenerCoverage : snapshot.takerCoverage;
    const rows = kind === "listener" ? assessment.listeners : assessment.takers;
    const invalid =
      kind === "listener"
        ? snapshot.invalidListenerCount
        : snapshot.invalidTakerCount;
    if (coverage !== "reported")
      missing.push(
        `${label} signals ${coverage === "invalid" ? "invalid" : "unreported"}`,
      );
    else if (!rows.length)
      missing.push(`No ${label.toLowerCase()} signals reported`);
    else {
      known += rows.filter((row) => row.state !== "unknown").length;
      const unknown = rows.filter((row) => row.state === "unknown").length;
      if (unknown)
        missing.push(
          `${unknown} ${label.toLowerCase()} ${unknown === 1 ? "signal unknown" : "signals unknown"}`,
        );
    }
    if (invalid)
      missing.push(
        `${invalid} malformed ${label.toLowerCase()} ${invalid === 1 ? "signal" : "signals"}`,
      );
  }
  const state = !missing.length ? "complete" : known ? "partial" : "unknown";
  return { state, label: `Coverage ${state}`, missing };
}

/** Counts orders on a service; worker observations do not establish causality. */
export function buildServiceOrderImpact(
  orders: ListOrder[],
  source: "v1" | "v2",
  snapshot: number,
) {
  const matching = orders.filter((order) => order.source === source);
  const active = matching.filter(
    (order) => getOverviewOrderStatus(order) === "active",
  );
  const placed = active.flatMap((order) => {
    const time = Date.parse(order.timestamp);
    return Number.isFinite(time) && time > 0 && time <= snapshot ? [time] : [];
  });
  return {
    orders: matching,
    active,
    overdue: active.filter((order) => {
      const deadline = Number(order.order.witness.deadline) * 1000;
      return Number.isFinite(deadline) && deadline > 0 && deadline <= snapshot;
    }),
    failed: matching.filter(
      (order) => getOverviewOrderStatus(order) === "failed",
    ),
    latestErrors: matching.filter(hasLastExecutionError),
    recovered: matching.filter(
      (order) =>
        getOverviewOrderStatus(order) === "completed" &&
        hasExecutionErrors(order),
    ),
    oldestActivePlacedAt: placed.length ? Math.min(...placed) : undefined,
  };
}

/** Reproduce the displayed global cohort without carrying unrelated local facets. */
export function serviceOrdersHref(
  query: string,
  source: "v1" | "v2",
  filters: {
    status?: string;
    errors?: string;
    deadline?: "past" | "soon" | "unreported";
    chainId?: number;
  } = {},
): string {
  const href = new URL(globalScopeHref("/orders", query), "http://ops.local");
  href.searchParams.set("order_source", source);
  if (filters.status) href.searchParams.set("order_status", filters.status);
  if (filters.errors) href.searchParams.set("order_errors", filters.errors);
  if (filters.deadline)
    href.searchParams.set("order_deadline", filters.deadline);
  if (filters.chainId !== undefined) {
    href.searchParams.delete("chain_id");
    href.searchParams.append("chain_id", String(filters.chainId));
  }
  return `${href.pathname}${href.search}`;
}
