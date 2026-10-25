import { formatUnits } from "viem";
import type { ListOrder, Order, OrderChunk } from "@orbs/domain/twap/types";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { hasLastExecutionError } from "../../lib/order-diagnostics";
import { getChainName } from "@orbs/domain/utils/utils";
import { OVERVIEW_STATUSES } from "@orbs/domain/twap/utils/orders-overview";
import { listOrderMessage, parseReportedTime } from "../../lib/order-evidence";

/** Keep reported status text separate from evidence of the latest chunk failure. */
export function orderListMessage(order: ListOrder): {
  text: string;
  error: boolean;
} {
  return listOrderMessage(order);
}

/** Historical error counts alone never make an active order currently erroring. */
export function orderRowStatus(order: ListOrder): string {
  const status = getOverviewOrderStatus(order);
  if (status !== "active") return OVERVIEW_STATUSES[status].label;
  if (hasLastExecutionError(order)) return "Active · latest attempt failed";
  const metadata = order.metadata;
  const states = [
    metadata.status,
    metadata.displayOnlyStatus,
    metadata.chunkSummary?.lastChunkStatus,
  ];
  const waitingState = states.some((value) =>
    /^(pending|waiting|pending[-_ ]price[-_ ]check)$/i.test(
      value?.trim() ?? "",
    ),
  );
  const reasons = [
    metadata.chunkSummary?.lastChunkDescription,
    metadata.displayOnlyStatusDescription,
    metadata.description,
  ];
  const waitingReason = reasons.some((value) =>
    /\bwaiting\b|\bprice\b[^.\n]*\b(?:condition|target)\b/i.test(value ?? ""),
  );
  return waitingState || waitingReason ? "Active · waiting" : "Active";
}

export function compactOrderType(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return "—";
  const normalized = raw.toLowerCase().replace(/[_-]/g, " ");
  if (/twap/.test(normalized)) {
    if (/take\s*profit|\btp\b/.test(normalized)) return "TWAP · take profit";
    if (/stop\s*loss|\bsl\b/.test(normalized)) return "TWAP · stop loss";
    return "TWAP";
  }
  if (/^market(?: order)?$/.test(normalized)) return "Market";
  if (/limit/.test(normalized)) return "Limit";
  if (/take\s*profit/.test(normalized)) return "Take profit";
  if (/stop\s*loss/.test(normalized)) return "Stop loss";
  return raw;
}

export function compactOrderNetwork(chainId: number | undefined): {
  label: string;
  title: string;
} {
  const name = getChainName(chainId);
  if (!name) {
    const label =
      chainId === undefined ? "Chain unreported" : `Unlisted chain ${chainId}`;
    return { label, title: label };
  }
  return {
    label: name,
    title: `${name} · Chain ${chainId}`,
  };
}

/** The caller supplies one shared clock; no render-time wall clock or implied execution timing. */
export function relativeOrderTime(value: unknown, now: number): string {
  const placed = reportedTime(value);
  if (placed === undefined || !Number.isFinite(now) || now <= 0)
    return "Unreported";
  const difference = now - placed;
  const elapsed = Math.abs(difference);
  if (elapsed < 60_000) return difference >= 0 ? "just now" : "in <1m";
  const [size, unit] =
    elapsed < 3_600_000
      ? [60_000, "m"]
      : elapsed < 86_400_000
        ? [3_600_000, "h"]
        : [86_400_000, "d"];
  const label = `${Math.floor(elapsed / Number(size))}${unit}`;
  return difference >= 0 ? `${label} ago` : `in ${label}`;
}

/** A reported timestamp is not an execution timestamp or a latency measurement. */
export function reportedTime(value: unknown): number | undefined {
  return parseReportedTime(value);
}

export function reportedScheduleValue(
  ...values: unknown[]
): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value) && value > 0)
      return String(value);
  }
}

export function sortedOrderChunks(chunks: OrderChunk[]): OrderChunk[] {
  return [...chunks].sort(
    (a, b) =>
      (reportedTime(b.timestamp) ?? reportedTime(b.createdAt) ?? 0) -
        (reportedTime(a.timestamp) ?? reportedTime(a.createdAt) ?? 0) ||
      b.index - a.index,
  );
}

export function latestOrderError(order: Order): OrderChunk | undefined {
  return sortedOrderChunks(order.metadata.chunks ?? []).find((chunk) =>
    /^(error|failed)$/i.test(chunk.status),
  );
}

/** Format only when token decimals and nonnegative integer raw units are known. */
export function tokenUnits(
  raw: unknown,
  decimals: unknown,
): string | undefined {
  if (
    typeof raw !== "string" ||
    !/^\d+$/.test(raw.trim()) ||
    typeof decimals !== "number" ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255
  )
    return;
  return formatUnits(BigInt(raw.trim()), decimals);
}

/** Short decimal display without converting exact raw units through Number. */
export function compactTokenAmount(amount: string): string {
  const [integer, fraction = ""] = amount.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (!fraction) return grouped;
  const leadingZeros = fraction.match(/^0*/)?.[0].length ?? 0;
  const precision = integer === "0" ? Math.min(leadingZeros + 4, 12) : 4;
  const short = fraction.slice(0, precision).replace(/0+$/, "");
  if (!short && /[1-9]/.test(fraction)) return "<0.000000000001";
  return `${grouped}${short ? `.${short}` : ""}${fraction.length > precision ? "…" : ""}`;
}

/** Keep raw service values in the disclosure, never infer units or a cause. */
export function conciseOrderMessage(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  const condition = firstLine.match(
    /^Price can't meet condition: expected ([\d.,]+), got ([\d.,]+)/i,
  );
  if (condition)
    return `Trading condition not met: expected ${condition[1]}, currently ${condition[2]}.`;
  const readable = firstLine.replace(/\s*\(\d{16,}\s+vs\.?\s+\d{16,}\)/g, "");
  return readable.length > 240 ? `${readable.slice(0, 237)}…` : readable;
}

/** Plain-language row summary; the untouched report remains in Technical details. */
export function orderReasonSummary(message: string): string {
  if (/price.*(?:condition|target)|trigger price not met/i.test(message))
    return /deadline|expired/i.test(message)
      ? "Expired before target price"
      : "Waiting for target price";
  if (/revert(?:ed|ing)?/i.test(message)) return "Transaction reverted";
  if (/\brpc\b|network error|connection (?:refused|reset)/i.test(message))
    return "Network request failed";
  if (/insufficient.*(?:funds|balance|allowance)/i.test(message))
    return "Insufficient funds or allowance reported";
  if (/deadline|expired/i.test(message)) return "Deadline reached";
  if (/cancel/i.test(message)) return "Order cancelled";
  if (/chunk executed successfully|all chunks successful/i.test(message))
    return "Trade completed successfully";
  const text = conciseOrderMessage(message);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

export function isZeroOutputLimit(value: unknown): boolean {
  return typeof value === "string" && /^0+$/.test(value.trim());
}

/** A past service timestamp is evidence, not an upcoming execution promise. */
export function orderScheduleLabel(
  kind: "eligible" | "price" | "retry",
  value: unknown,
  snapshot: number,
): string {
  const time = reportedTime(value);
  const upcoming =
    time !== undefined &&
    Number.isFinite(snapshot) &&
    snapshot > 0 &&
    time > snapshot;
  if (kind === "price")
    return upcoming ? "Next reported price check" : "Reported price check time";
  if (kind === "retry")
    return upcoming ? "Retry eligible after" : "Reported retry eligibility";
  return upcoming ? "Next reported eligible time" : "Reported eligible time";
}
