import type { ListOrder } from "@orbs/domain/twap/types";
import {
  getOrderValueUsd,
  getOverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import {
  getFailureReason,
  hasExecutionErrors,
  hasLastExecutionError,
  executionErrorCount,
  reportedNumber,
} from "./order-diagnostics";
import {
  classifyFailureReason,
  type FailureReasonCategory,
} from "./failure-classification";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface ExecutionCohort {
  id: string;
  label: string;
  description: string;
  orders: ListOrder[];
}

export function placementTime(order: ListOrder): number | undefined {
  const timestamp = Date.parse(order.timestamp);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

export function deadlineTime(order: ListOrder): number | undefined {
  const seconds = reportedNumber(order.order?.witness?.deadline);
  if (seconds === undefined || seconds <= 0) return;
  const timestamp = seconds * 1000;
  return Number.isFinite(timestamp) && timestamp <= 8.64e15
    ? timestamp
    : undefined;
}

/** Shared review rules. Age and earlier recovered errors are contextual. */
export function activeOrderReviewState(order: ListOrder, snapshot: number) {
  if (getOverviewOrderStatus(order) !== "active") return;
  const deadline = deadlineTime(order);
  return {
    pastDeadline: deadline !== undefined && deadline <= snapshot,
    latestAttemptFailed: hasLastExecutionError(order),
    deadlineUnreported: deadline === undefined,
  };
}

function cohort(
  id: string,
  label: string,
  description: string,
): ExecutionCohort {
  return { id, label, description, orders: [] };
}

export function buildExecutionHealth(orders: ListOrder[], snapshot: number) {
  const active = orders.filter(
    (order) => getOverviewOrderStatus(order) === "active",
  );
  const deadlines = [
    cohort(
      "past",
      "Past deadline",
      "Reported deadline is at or before the snapshot.",
    ),
    cohort(
      "hour",
      "Within 1 hour",
      "Deadline is after the snapshot and within 1 hour.",
    ),
    cohort(
      "day",
      "1–24 hours",
      "Deadline is more than 1 hour and within 24 hours.",
    ),
    cohort(
      "later",
      "More than 24 hours",
      "Deadline is more than 24 hours after the snapshot.",
    ),
    cohort(
      "missing",
      "Deadline unavailable",
      "No usable deadline was provided.",
    ),
  ];
  const ages = [
    cohort(
      "hour",
      "Less than 1 hour",
      "Time since placement is less than 1 hour.",
    ),
    cohort(
      "six",
      "1–6 hours",
      "Time since placement is at least 1 hour and less than 6 hours.",
    ),
    cohort(
      "day",
      "6–24 hours",
      "Time since placement is at least 6 hours and less than 24 hours.",
    ),
    cohort(
      "week",
      "1–7 days",
      "Time since placement is at least 1 day and less than 7 days.",
    ),
    cohort(
      "older",
      "7 days or more",
      "Time since placement is at least 7 days.",
    ),
    cohort(
      "missing",
      "Placement unavailable",
      "Placement time is missing, invalid, or after the snapshot.",
    ),
  ];
  const signals = [
    cohort(
      "price",
      "Waiting for a price check",
      "The service reports a pending price check.",
    ),
    cohort(
      "eligible",
      "Eligible for execution",
      "The raw order status is eligible.",
    ),
    cohort(
      "pending",
      "Pending / other active",
      "Other orders classified as active by the service.",
    ),
  ];
  let successfulChunks = 0;
  let errorChunks = 0;
  let successfulCoverage = 0;
  let errorCoverage = 0;
  let remainingChunks = 0;
  let remainingCoverage = 0;
  const noSuccess: ListOrder[] = [];
  const withProgress: ListOrder[] = [];
  const progressUnavailable: ListOrder[] = [];
  const ageByOrder = new Map<ListOrder, number>();
  for (const order of active) {
    const deadline = deadlineTime(order);
    const remaining = deadline === undefined ? undefined : deadline - snapshot;
    const deadlineIndex =
      remaining === undefined
        ? 4
        : remaining <= 0
          ? 0
          : remaining <= HOUR
            ? 1
            : remaining <= DAY
              ? 2
              : 3;
    deadlines[deadlineIndex].orders.push(order);
    const placed = placementTime(order);
    const age =
      placed === undefined || placed > snapshot ? undefined : snapshot - placed;
    if (age !== undefined) ageByOrder.set(order, age);
    const ageIndex =
      age === undefined
        ? 5
        : age < HOUR
          ? 0
          : age < 6 * HOUR
            ? 1
            : age < DAY
              ? 2
              : age < 7 * DAY
                ? 3
                : 4;
    ages[ageIndex].orders.push(order);
    const raw = order.metadata.status?.toLowerCase();
    const display = order.metadata.displayOnlyStatus?.toLowerCase();
    const priceCheck = [raw, display].some(
      (status) =>
        status === "pending-price-check" || status === "pending_price_check",
    );
    signals[priceCheck ? 0 : raw === "eligible" ? 1 : 2].orders.push(order);
    const summary = order.metadata.chunkSummary;
    const success = reportedNumber(summary?.success);
    const errors = executionErrorCount(order);
    const expected = reportedNumber(order.metadata.expectedChunks);
    if (success !== undefined) {
      successfulChunks += success;
      successfulCoverage++;
      (success > 0 ? withProgress : noSuccess).push(order);
    } else progressUnavailable.push(order);
    if (errors !== undefined) {
      errorChunks += errors;
      errorCoverage++;
    }
    if (success !== undefined && expected !== undefined) {
      remainingChunks += Math.max(0, expected - success);
      remainingCoverage++;
    }
  }
  const activeWithErrors = active.filter(hasExecutionErrors);
  const lastErrors = active.filter(hasLastExecutionError);
  const oldOrders = active.filter(
    (order) => (ageByOrder.get(order) ?? -1) >= DAY,
  );
  // Match the global/app summaries. Age, upcoming deadlines and recovered
  // errors remain available as context cohorts rather than actionable issues.
  const attention = active
    .filter((order) => {
      const state = activeOrderReviewState(order, snapshot);
      return (
        state &&
        (state.pastDeadline ||
          state.latestAttemptFailed ||
          state.deadlineUnreported)
      );
    })
    .sort((a, b) => {
      const aDeadline = deadlineTime(a) ?? Infinity;
      const bDeadline = deadlineTime(b) ?? Infinity;
      const aPast = Number(aDeadline <= snapshot);
      const bPast = Number(bDeadline <= snapshot);
      return (
        bPast - aPast ||
        Number(hasLastExecutionError(b)) - Number(hasLastExecutionError(a)) ||
        aDeadline - bDeadline ||
        (placementTime(a) ?? Infinity) - (placementTime(b) ?? Infinity)
      );
    });
  return {
    active,
    deadlines,
    ages,
    signals,
    activeWithErrors,
    lastErrors,
    oldOrders,
    attention,
    successfulChunks,
    successfulCoverage,
    errorChunks,
    errorCoverage,
    remainingChunks,
    remainingCoverage,
    noSuccess,
    withProgress,
    progressUnavailable,
    activeValue: active.reduce(
      (sum, order) => sum + getOrderValueUsd(order),
      0,
    ),
    activeValueCoverage: active.filter(
      (order) => reportedNumber(order.totalUSDAmount) !== undefined,
    ).length,
  };
}

export type FailureCohortId =
  | "all"
  | "terminal"
  | "latest"
  | "active"
  | "completed";

export function buildFailureAnalytics(orders: ListOrder[]) {
  const terminal = orders.filter(
    (order) => getOverviewOrderStatus(order) === "failed",
  );
  const latest = orders.filter(hasLastExecutionError);
  const history = orders.filter(hasExecutionErrors);
  const active = history.filter(
    (order) => getOverviewOrderStatus(order) === "active",
  );
  const completed = history.filter(
    (order) => getOverviewOrderStatus(order) === "completed",
  );
  const all = orders.filter(
    (order) =>
      hasExecutionErrors(order) || getOverviewOrderStatus(order) === "failed",
  );
  const cohorts: Record<FailureCohortId, ListOrder[]> = {
    all,
    terminal,
    latest,
    active,
    completed,
  };
  const reasons = new Map<
    string,
    {
      reason: string;
      category: FailureReasonCategory;
      orders: ListOrder[];
      value: number;
      valueCoverage: number;
      latestPlaced?: number;
      terminal: ListOrder[];
      active: ListOrder[];
      completed: ListOrder[];
    }
  >();
  for (const order of all) {
    const reason =
      getFailureReason(order) ??
      "Earlier error reason unavailable in this summary";
    const group = reasons.get(reason) ?? {
      reason,
      category: classifyFailureReason(reason),
      orders: [],
      value: 0,
      valueCoverage: 0,
      terminal: [],
      active: [],
      completed: [],
    };
    group.orders.push(order);
    group.value += getOrderValueUsd(order);
    if (reportedNumber(order.totalUSDAmount) !== undefined)
      group.valueCoverage++;
    const placed = placementTime(order);
    if (placed !== undefined)
      group.latestPlaced = Math.max(group.latestPlaced ?? 0, placed);
    const status = getOverviewOrderStatus(order);
    if (status === "failed") group.terminal.push(order);
    else if (status === "active") group.active.push(order);
    else if (status === "completed") group.completed.push(order);
    reasons.set(reason, group);
  }
  let reportedErrors = 0;
  let errorCoverage = 0;
  for (const order of orders) {
    const errors = executionErrorCount(order);
    if (errors !== undefined) {
      reportedErrors += errors;
      errorCoverage++;
    }
  }
  return {
    cohorts,
    history,
    reportedErrors,
    errorCoverage,
    reasons: [...reasons.values()].sort(
      (a, b) =>
        b.orders.length - a.orders.length ||
        (b.latestPlaced ?? 0) - (a.latestPlaced ?? 0) ||
        a.reason.localeCompare(b.reason),
    ),
  };
}

export function buildFailureImpact(
  groups: { id: string; label: string; orders: ListOrder[] }[],
) {
  return groups
    .map((group) => {
      const diagnostics = buildFailureAnalytics(group.orders);
      return {
        ...group,
        ...diagnostics.cohorts,
        affectedValue: diagnostics.cohorts.all.reduce(
          (sum, order) => sum + getOrderValueUsd(order),
          0,
        ),
        affectedValueCoverage: diagnostics.cohorts.all.filter(
          (order) => reportedNumber(order.totalUSDAmount) !== undefined,
        ).length,
      };
    })
    .filter((group) => group.all.length > 0)
    .sort(
      (a, b) => b.all.length - a.all.length || a.label.localeCompare(b.label),
    );
}
