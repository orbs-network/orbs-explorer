import type { ListOrder } from "@orbs/domain/twap/types";
import {
  getOrderValueUsd,
  getOverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { listOrderMessage } from "./order-evidence";

export function reportedNumber(value: unknown): number | undefined {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  )
    return;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

export function hasLastExecutionError(order: ListOrder) {
  return /^(error|failed)$/i.test(
    order.metadata.chunkSummary?.lastChunkStatus ?? "",
  );
}

export function hasExecutionErrors(order: ListOrder) {
  return (
    (reportedNumber(order.metadata.chunkSummary?.error) ?? 0) > 0 ||
    hasLastExecutionError(order)
  );
}

export function getFailureReason(order: ListOrder): string | undefined {
  const message = listOrderMessage(order);
  return message.error ? message.text : undefined;
}

export function buildOrderDiagnostics(orders: ListOrder[], snapshot: number) {
  const withErrors = orders.filter(hasExecutionErrors);
  const activeWithErrors = withErrors.filter(
    (order) => getOverviewOrderStatus(order) === "active",
  );
  const lastErrors = orders.filter(hasLastExecutionError);
  const priced = orders.filter(
    (order) => reportedNumber(order.totalUSDAmount) !== undefined,
  );
  const summaries = orders.filter((order) => order.metadata.chunkSummary);
  const successful = summaries.filter(
    (order) =>
      reportedNumber(order.metadata.chunkSummary.success) !== undefined,
  );
  const failed = summaries.filter(
    (order) => reportedNumber(order.metadata.chunkSummary.error) !== undefined,
  );
  const expected = orders.filter(
    (order) => reportedNumber(order.metadata.expectedChunks) !== undefined,
  );
  const types = new Map<
    string,
    { label: string; orders: ListOrder[]; value: number }
  >();
  const sources = new Map<string, number>();
  const reasons = new Map<
    string,
    { reason: string; orders: ListOrder[]; latest: number }
  >();
  let firstPlaced = Infinity;
  let lastPlaced = 0;
  let recentOrders = 0;
  let expiring = 0;
  let overdue = 0;
  for (const order of orders) {
    const placed = Date.parse(order.timestamp);
    if (Number.isFinite(placed) && placed > 0) {
      firstPlaced = Math.min(firstPlaced, placed);
      lastPlaced = Math.max(lastPlaced, placed);
      if (placed >= snapshot - 86_400_000 && placed <= snapshot) recentOrders++;
    }
    if (getOverviewOrderStatus(order) === "active") {
      const deadline = Number(order.order.witness.deadline) * 1000;
      if (Number.isFinite(deadline) && deadline > 0) {
        if (deadline <= snapshot) overdue++;
        else if (deadline <= snapshot + 86_400_000) expiring++;
      }
    }
    const label = order.metadata.orderType?.trim() || "Type not provided";
    const type = types.get(label) ?? { label, orders: [], value: 0 };
    type.orders.push(order);
    type.value += getOrderValueUsd(order);
    types.set(label, type);
    const source = order.source ?? "Not provided";
    sources.set(source, (sources.get(source) ?? 0) + 1);
    const reason = getFailureReason(order);
    if (reason) {
      const group = reasons.get(reason) ?? { reason, orders: [], latest: 0 };
      group.orders.push(order);
      if (Number.isFinite(placed))
        group.latest = Math.max(group.latest, placed);
      reasons.set(reason, group);
    }
  }
  return {
    withErrors,
    activeWithErrors,
    lastErrors,
    successfulChunks: successful.reduce(
      (sum, order) =>
        sum + (reportedNumber(order.metadata.chunkSummary.success) ?? 0),
      0,
    ),
    successfulCoverage: successful.length,
    errorChunks: failed.reduce(
      (sum, order) =>
        sum + (reportedNumber(order.metadata.chunkSummary.error) ?? 0),
      0,
    ),
    errorCoverage: failed.length,
    expectedChunks: expected.reduce(
      (sum, order) =>
        sum + (reportedNumber(order.metadata.expectedChunks) ?? 0),
      0,
    ),
    expectedCoverage: expected.length,
    pricedOrders: priced.length,
    averageValue: priced.length
      ? priced.reduce((sum, order) => sum + getOrderValueUsd(order), 0) /
        priced.length
      : undefined,
    largestValue: priced.length
      ? priced.reduce((max, order) => Math.max(max, getOrderValueUsd(order)), 0)
      : undefined,
    recentOrders,
    expiring,
    overdue,
    firstPlaced: Number.isFinite(firstPlaced) ? firstPlaced : undefined,
    lastPlaced: lastPlaced || undefined,
    types: [...types.values()].sort(
      (a, b) =>
        b.orders.length - a.orders.length || a.label.localeCompare(b.label),
    ),
    sources: [...sources].sort(([a], [b]) => a.localeCompare(b)),
    reasons: [...reasons.values()].sort(
      (a, b) =>
        b.orders.length - a.orders.length ||
        b.latest - a.latest ||
        a.reason.localeCompare(b.reason),
    ),
  };
}
