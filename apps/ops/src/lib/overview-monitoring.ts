import type { ListOrder } from "@orbs/domain/twap/types";
import {
  getOverviewOrderStatus,
  type PartnerCard,
} from "@orbs/domain/twap/utils/orders-overview";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { hasLastExecutionError } from "./order-diagnostics";
import { deadlineTime } from "./execution-analytics";

const HOUR = 3_600_000;
export const MONITORING_STORAGE_KEY = "orbs.ops.monitoring.v1";
export type MonitoringRules = {
  failureRatePercent: number;
  minimumOrders: number;
  windowHours: 24 | 168;
  inactivityHours: Record<string, number>;
};
export const DEFAULT_MONITORING_RULES: MonitoringRules = {
  failureRatePercent: 20,
  minimumOrders: 10,
  windowHours: 24,
  inactivityHours: {},
};

export type ActivityExpectationPartner = {
  partnerId: string;
  partnerName: string;
  chainIds: string[];
};

/** Ignore invalid or future storage schemas instead of treating them as rules. */
export function parseMonitoringRules(raw: string | null): MonitoringRules {
  if (!raw || raw.length > 100_000) return DEFAULT_MONITORING_RULES;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("version" in value) ||
      value.version !== 1 ||
      !("rules" in value)
    )
      return DEFAULT_MONITORING_RULES;
    const rules = value.rules;
    if (!rules || typeof rules !== "object") return DEFAULT_MONITORING_RULES;
    const candidate = rules as Record<string, unknown>;
    const valid = (key: string, min: number, max: number, integer = false) => {
      const number = candidate[key];
      return (
        typeof number === "number" &&
        Number.isFinite(number) &&
        number >= min &&
        number <= max &&
        (!integer || Number.isInteger(number))
      );
    };
    const inactivity: Record<string, number> = {};
    if (
      candidate.inactivityHours &&
      typeof candidate.inactivityHours === "object" &&
      !Array.isArray(candidate.inactivityHours)
    ) {
      for (const [id, hours] of Object.entries(candidate.inactivityHours).slice(
        0,
        200,
      )) {
        if (
          id &&
          id.length <= 200 &&
          id !== "__proto__" &&
          id !== "constructor" &&
          typeof hours === "number" &&
          Number.isFinite(hours) &&
          hours >= 1 &&
          hours <= 8760
        )
          inactivity[id] = hours;
      }
    }
    return {
      failureRatePercent: valid("failureRatePercent", 1, 100)
        ? (candidate.failureRatePercent as number)
        : DEFAULT_MONITORING_RULES.failureRatePercent,
      minimumOrders: valid("minimumOrders", 1, 10000, true)
        ? (candidate.minimumOrders as number)
        : DEFAULT_MONITORING_RULES.minimumOrders,
      windowHours: candidate.windowHours === 168 ? 168 : 24,
      inactivityHours: inactivity,
    };
  } catch {
    return DEFAULT_MONITORING_RULES;
  }
}

export type ActivityBucket = {
  timestamp: number;
  end: number;
  label: string;
  orders: ListOrder[];
  completed: number;
  failed: number;
  other: number;
  failureRate?: number;
};

/** Placement cohorts, never inferred completion/error event timestamps. */
export function buildRecentActivity(
  orders: ListOrder[],
  snapshot: number,
  hours: 24 | 168,
): {
  buckets: ActivityBucket[];
  orders: ListOrder[];
  excludedTimestamps: number;
} {
  if (!Number.isFinite(snapshot) || snapshot <= 0 || snapshot > 8.64e15)
    return { buckets: [], orders: [], excludedTimestamps: orders.length };
  const interval = hours === 24 ? HOUR : 24 * HOUR;
  const start = snapshot - hours * HOUR;
  // Exact rolling intervals keep the first/last bucket the same duration.
  const count = hours === 24 ? 24 : 7;
  const buckets: ActivityBucket[] = Array.from(
    { length: count },
    (_, index) => {
      const timestamp = start + index * interval;
      return {
        timestamp,
        end: timestamp + interval,
        label: new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          ...(hours === 24
            ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
            : { month: "short", day: "numeric" }),
        }).format(timestamp),
        orders: [],
        completed: 0,
        failed: 0,
        other: 0,
      };
    },
  );
  let excludedTimestamps = 0;
  const recent: ListOrder[] = [];
  for (const order of orders) {
    const placed = Date.parse(order.timestamp);
    if (!Number.isFinite(placed) || placed <= 0 || placed > snapshot) {
      excludedTimestamps++;
      continue;
    }
    if (placed < start) continue;
    const bucket =
      buckets[Math.min(count - 1, Math.floor((placed - start) / interval))];
    bucket.orders.push(order);
    const status = getOverviewOrderStatus(order);
    bucket[status === "completed" || status === "failed" ? status : "other"]++;
    recent.push(order);
  }
  for (const bucket of buckets)
    bucket.failureRate = bucket.orders.length
      ? bucket.failed / bucket.orders.length
      : undefined;
  return { buckets, orders: recent, excludedTimestamps };
}

export function buildOverviewSignals({
  orders,
  partnerCards,
  snapshot,
  rules,
  lastOrderByPartner = {},
  activityPartners,
}: {
  orders: ListOrder[];
  partnerCards: PartnerCard[];
  snapshot: number;
  rules: MonitoringRules;
  lastOrderByPartner?: Record<string, number>;
  activityPartners?: readonly ActivityExpectationPartner[];
}) {
  const start = snapshot - rules.windowHours * HOUR;
  const overdue: ListOrder[] = [];
  const latestErrors: ListOrder[] = [];
  let activeWithoutDeadline = 0;
  const networks = new Map<
    number,
    {
      chainId: number;
      orders: ListOrder[];
      failed: ListOrder[];
      latestErrors: ListOrder[];
    }
  >();
  for (const order of orders) {
    if (getOverviewOrderStatus(order) === "active") {
      const deadline = deadlineTime(order);
      if (deadline === undefined) activeWithoutDeadline++;
      else if (deadline <= snapshot) overdue.push(order);
    }
    if (hasLastExecutionError(order)) latestErrors.push(order);
    const chainId = getTwapOrderChainId(order) ?? 0;
    const row = networks.get(chainId) ?? {
      chainId,
      orders: [],
      failed: [],
      latestErrors: [],
    };
    row.orders.push(order);
    if (getOverviewOrderStatus(order) === "failed") row.failed.push(order);
    if (hasLastExecutionError(order)) row.latestErrors.push(order);
    networks.set(chainId, row);
  }
  const apps = partnerCards.map((card) => {
    const recent = card.chains
      .flatMap((chain) => chain.orders)
      .filter((order) => {
        const placed = Date.parse(order.timestamp);
        return Number.isFinite(placed) && placed >= start && placed <= snapshot;
      });
    const failed = recent.filter(
      (order) => getOverviewOrderStatus(order) === "failed",
    );
    const rate = recent.length ? failed.length / recent.length : undefined;
    return {
      partnerId: card.partnerId,
      chainIds: card.chains.map((chain) => String(chain.chainId)),
      partnerName: card.partnerName,
      recent,
      failed,
      rate,
      elevated:
        recent.length >= rules.minimumOrders &&
        failed.length > 0 &&
        rate! * 100 >= rules.failureRatePercent,
    };
  });
  // A quiet, unidentified app can be absent from the period's table cards.
  // Expectations follow all-history identities within the same app/network
  // scope, so inactivity cannot hide the rule that is meant to detect it.
  const expectedApps = (
    activityPartners ??
    partnerCards.map((card) => ({
      partnerId: card.partnerId,
      partnerName: card.partnerName,
      chainIds: card.chains.map((chain) => String(chain.chainId)),
    }))
  ).flatMap((partner) => {
    const expectedHours = Object.hasOwn(
      rules.inactivityHours,
      partner.partnerId,
    )
      ? rules.inactivityHours[partner.partnerId]
      : undefined;
    if (expectedHours === undefined) return [];
    const lastPlaced = lastOrderByPartner[partner.partnerId];
    return [
      {
        ...partner,
        expectedHours,
        lastPlaced,
        idle:
          lastPlaced === undefined ||
          snapshot - lastPlaced >= expectedHours * HOUR,
      },
    ];
  });
  return {
    overdue,
    latestErrors,
    activeWithoutDeadline,
    elevatedApps: apps
      .filter((app) => app.elevated)
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)),
    expectedApps: expectedApps.sort(
      (a, b) =>
        Number(b.idle) - Number(a.idle) ||
        a.partnerName.localeCompare(b.partnerName),
    ),
    networks: [...networks.values()].sort(
      (a, b) =>
        b.latestErrors.length - a.latestErrors.length ||
        b.failed.length - a.failed.length ||
        b.orders.length - a.orders.length,
    ),
  };
}
