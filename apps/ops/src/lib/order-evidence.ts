import type { ListOrder, Order, OrderChunk } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  getOverviewOrderStatus,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";

export function isErrorStatus(status: string | undefined): boolean {
  return /^(error|failed)$/i.test(status?.trim() ?? "");
}

/** Service detail chunks use extraTitleTranslated when description is absent. */
export function chunkReason(chunk: OrderChunk | undefined): string | undefined {
  return (
    chunk?.description?.trim() ||
    chunk?.extraTitleTranslated?.trim() ||
    chunk?.extraTitle?.trim() ||
    undefined
  );
}

/** The sink stores its contract-cancellation event with a legacy error status. */
export function isContractCancellation(reason: string | undefined): boolean {
  return /^cancel(?:led|ed) by contract[.!]?$/i.test(reason?.trim() ?? "");
}

export function isCancellationChunk(chunk: OrderChunk | undefined): boolean {
  return (
    /^cancel(?:led|ed)$/i.test(chunk?.status?.trim() ?? "") ||
    isContractCancellation(chunkReason(chunk))
  );
}

export function isExecutionErrorChunk(chunk: OrderChunk | undefined): boolean {
  return isErrorStatus(chunk?.status) && !isCancellationChunk(chunk);
}

export function listOrderMessage(order: ListOrder): {
  text: string;
  error: boolean;
} {
  const latestError =
    isErrorStatus(order.metadata.chunkSummary?.lastChunkStatus) &&
    !isContractCancellation(order.metadata.chunkSummary?.lastChunkDescription);
  const error = latestError || getOverviewOrderStatus(order) === "failed";
  const serviceReason =
    order.metadata.displayOnlyStatusDescription?.trim() ||
    order.metadata.description?.trim();
  return {
    text:
      error && !latestError
        ? serviceReason || "No failure reason reported"
        : order.metadata.chunkSummary?.lastChunkDescription?.trim() ||
          serviceReason ||
          (error ? "No failure reason reported" : ""),
    error,
  };
}

type StatusMetadata = Pick<
  ListOrder["metadata"],
  | "status"
  | "displayOnlyStatus"
  | "description"
  | "displayOnlyStatusDescription"
>;
export type OrderStatusConflict = {
  kind: "structured" | "termination-review";
  rawStatus: string;
  displayStatus: string;
  normalizedOutcome: OverviewOrderStatus;
  message: string;
};

/** Diagnostic evidence only. Never changes the shared lifecycle classification. */
export function getOrderStatusConflict(order: {
  metadata: StatusMetadata;
}): OrderStatusConflict | undefined {
  const { status = "", displayOnlyStatus = "" } = order.metadata;
  const raw = status.trim().toLowerCase();
  const display = displayOnlyStatus.trim().toUpperCase();
  const rawOutcomes: Record<string, OverviewOrderStatus> = {
    cancelled: "cancelled",
    expired: "expired",
    completed: "completed",
    partially_completed: "partial",
    pending: "active",
    eligible: "active",
    failed: "failed",
    error: "failed",
  };
  const displayOutcomes: Record<string, OverviewOrderStatus> = {
    CANCELLED: "cancelled",
    EXPIRED: "expired",
    SUCCEEDED: "completed",
    "PARTIALLY SUCCEEDED": "partial",
    PENDING: "active",
    "PENDING-PRICE-CHECK": "active",
    FAILED: "failed",
    ERROR: "failed",
  };
  const normalizedOutcome = getOverviewOrderStatus(order as ListOrder);
  const rawOutcome = rawOutcomes[raw];
  const displayOutcome = displayOutcomes[display];
  // ERROR is also an execution-attempt display state on a pending order.
  const activeAttemptError =
    rawOutcome === "active" && displayOutcome === "failed";
  const base = {
    rawStatus: status,
    displayStatus: displayOnlyStatus,
    normalizedOutcome,
  };
  if (
    rawOutcome &&
    displayOutcome &&
    rawOutcome !== displayOutcome &&
    !activeAttemptError
  )
    return {
      ...base,
      kind: "structured",
      message:
        "The service lifecycle and display status disagree. The shared outcome is retained; review the raw fields before treating this as a confirmed technical failure.",
    };
  // The API has no structured termination-reason code. This is a review cue,
  // explicitly not an inferred Expired/Cancelled classification.
  if (
    normalizedOutcome === "failed" &&
    /^(?:expired|cancelled|canceled)\b/i.test(
      order.metadata.description?.trim() ?? "",
    )
  )
    return {
      ...base,
      kind: "termination-review",
      message:
        "The service reports Failed with an expiry or cancellation description. No structured termination-reason code was returned, so the outcome remains Failed and needs review.",
    };
}

/** Only retain observations for the exact network, hash, and returned service. */
export function matchingListOrder(
  full: Order,
  orders: ListOrder[],
): ListOrder | undefined {
  const chainId = getTwapOrderChainId(full);
  if (chainId === undefined || full.source === undefined) return;
  return orders.find(
    (order) =>
      order.hash.toLowerCase() === full.hash.toLowerCase() &&
      getTwapOrderChainId(order) === chainId &&
      order.source === full.source,
  );
}

/** Parses only explicit ISO/Unix values; counters and missing fields stay unknown. */
export function parseReportedTime(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return;
  const text = String(value).trim();
  if (!text) return;
  const numeric = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : undefined;
  const timestamp =
    numeric === undefined
      ? /^\d{4}-\d{2}-\d{2}T/.test(text)
        ? Date.parse(text)
        : NaN
      : numeric >= 1e12
        ? numeric
        : numeric >= 1e9
          ? numeric * 1000
          : NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

export type OrderReasonObservation = {
  text: string;
  field: string;
  label: string;
  error: boolean;
  timestamp?: string;
  historical?: boolean;
};

/** Keep useful service reasons discoverable, including differing observations. */
export function detailReasonObservations(
  full: Order,
  chunks: OrderChunk[],
  list: ListOrder,
): OrderReasonObservation[] {
  const observations: OrderReasonObservation[] = [];
  const seen = new Set<string>();
  const add = (observation: OrderReasonObservation) => {
    if (!observation.text.trim() || seen.has(observation.text.trim())) return;
    seen.add(observation.text.trim());
    observations.push(observation);
  };
  const latest = chunks[0];
  const currentError = isExecutionErrorChunk(latest);
  const lifecycleFailed = getOverviewOrderStatus(list) === "failed";
  if (!currentError && lifecycleFailed) {
    if (full.metadata.displayOnlyStatusDescription?.trim())
      add({
        text: full.metadata.displayOnlyStatusDescription.trim(),
        field: "metadata.displayOnlyStatusDescription",
        label: "Service status reason",
        error: true,
      });
    else if (full.metadata.description?.trim())
      add({
        text: full.metadata.description.trim(),
        field: "metadata.description",
        label: "Lifecycle description",
        error: true,
      });
    else
      add({
        text: "No failure reason reported",
        field: "",
        label: "Failure reason unavailable",
        error: true,
      });
  }
  if (latest && chunkReason(latest))
    add({
      text: chunkReason(latest)!,
      field: latest.description?.trim()
        ? "chunk.description"
        : latest.extraTitleTranslated?.trim()
          ? "chunk.extraTitleTranslated"
          : "chunk.extraTitle",
      label: currentError ? "Latest execution error" : "Latest chunk message",
      error: currentError,
      timestamp: latest.timestamp,
    });
  if (latest?.description?.trim() && latest.extraTitleTranslated?.trim())
    add({
      text: latest.extraTitleTranslated.trim(),
      field: "chunk.extraTitleTranslated",
      label: "Execution reason",
      error: currentError,
      timestamp: latest.timestamp,
    });
  if (full.metadata.displayOnlyStatusDescription?.trim())
    add({
      text: full.metadata.displayOnlyStatusDescription.trim(),
      field: "metadata.displayOnlyStatusDescription",
      label: "Service status reason",
      error: currentError || lifecycleFailed,
    });
  if (full.metadata.description?.trim())
    add({
      text: full.metadata.description.trim(),
      field: "metadata.description",
      label: "Lifecycle description",
      error: lifecycleFailed,
    });
  const historical = chunks.find(
    (chunk) => isExecutionErrorChunk(chunk) && chunkReason(chunk),
  );
  if (historical && historical !== latest)
    add({
      text: chunkReason(historical)!,
      field: "chunk error reason",
      label: "Earlier execution error",
      error: false,
      timestamp: historical.timestamp,
      historical: true,
    });
  return observations;
}

/** Raw quantities only; never estimate execution from chunk counts or prices. */
export function reportedExecutionInput(full: Order): string | undefined {
  return reportedExecutionAmount(full, "input");
}

export function reportedExecutionOutput(full: Order): string | undefined {
  return reportedExecutionAmount(full, "output");
}

function reportedExecutionAmount(
  full: Order,
  side: "input" | "output",
): string | undefined {
  const chunks = full.metadata.chunks ?? [];
  const successes = chunks.filter((chunk) =>
    /^(success|completed|succeeded)$/i.test(chunk.status),
  );
  if (
    !successes.length ||
    new Set(chunks.map((chunk) => chunk.index)).size !== chunks.length
  )
    return;
  const token = full.order.witness[side]?.token?.toLowerCase();
  if (!token) return;
  const amountKey = side === "input" ? "inAmount" : "outAmount";
  const tokenKey = side === "input" ? "inToken" : "outToken";
  if (
    successes.some(
      (chunk) =>
        !/^\d+$/.test(chunk[amountKey]?.trim() ?? "") ||
        (chunk[tokenKey] && chunk[tokenKey].toLowerCase() !== token),
    )
  )
    return;
  return successes
    .reduce((total, chunk) => total + BigInt(chunk[amountKey]!), BigInt(0))
    .toString();
}
