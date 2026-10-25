import type { ListOrder, SpotConfig } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  getOverviewOrderStatus,
  getPartnerChainPairs,
} from "@orbs/domain/twap/utils/orders-overview";
import { reportedNumber } from "./order-diagnostics";
import { getOrderStatusConflict } from "./order-evidence";

const address = /^0x[0-9a-f]{40}$/i;
const hash = /^0x[0-9a-f]{64}$/i;
const validCount = (value: unknown) => {
  const number = reportedNumber(value);
  return number !== undefined && Number.isInteger(number);
};
const validDate = (value: string) => {
  const number = Date.parse(value);
  return Number.isFinite(number) && number > 0;
};
const validDeadline = (order: ListOrder) => {
  const number = reportedNumber(order.order?.witness?.deadline);
  return (
    number !== undefined &&
    number > 0 &&
    Number.isFinite(new Date(number * 1000).getTime())
  );
};

export function buildDataQuality(
  orders: ListOrder[],
  snapshot: number,
  config: SpotConfig | null,
) {
  const configured = new Set(
    getPartnerChainPairs(config).map(
      (pair) => `${pair.chainId}:${pair.adapter.toLowerCase()}`,
    ),
  );
  const checks: {
    key: string;
    label: string;
    description: string;
    valid: (order: ListOrder) => boolean;
  }[] = [
    {
      key: "usd",
      label: "Placed USD value",
      description:
        "A finite, nonnegative reported amount. Zero is valid; missing values are excluded from size averages.",
      valid: (order) => reportedNumber(order.totalUSDAmount) !== undefined,
    },
    {
      key: "time",
      label: "Placement timestamp",
      description:
        "A valid positive date, no later than the snapshot. Date issues exclude records from time charts.",
      valid: (order) =>
        validDate(order.timestamp) && Date.parse(order.timestamp) <= snapshot,
    },
    {
      key: "status",
      label: "Recognized current outcome",
      description:
        "A current status that maps to completed, partial, active, failed, expired, or cancelled.",
      valid: (order) => getOverviewOrderStatus(order) !== "unknown",
    },
    {
      key: "chain",
      label: "Network identifier",
      description:
        "A positive integer network ID, including supported legacy chainid fields.",
      valid: (order) => getTwapOrderChainId(order) !== undefined,
    },
    {
      key: "hash",
      label: "Order hash",
      description: "A 32-byte hexadecimal order identifier.",
      valid: (order) => hash.test(order.hash ?? ""),
    },
    {
      key: "adapter",
      label: "Exchange adapter",
      description: "A 20-byte hexadecimal exchange adapter address.",
      valid: (order) => address.test(order.exchangeAdapter ?? ""),
    },
    {
      key: "tokens",
      label: "Token addresses",
      description:
        "Both input and output are 20-byte hexadecimal addresses. Native zero addresses are accepted.",
      valid: (order) =>
        address.test(order.inputToken ?? "") &&
        address.test(order.outputToken ?? ""),
    },
    {
      key: "deadline",
      label: "Deadline",
      description:
        "A positive Unix timestamp in seconds that can be displayed as a date.",
      valid: validDeadline,
    },
    {
      key: "expected",
      label: "Planned chunks",
      description:
        "A reported nonnegative integer. Zero remains a reported value; it cannot be used as a progress denominator.",
      valid: (order) => validCount(order.metadata.expectedChunks),
    },
    {
      key: "success",
      label: "Successful chunk count",
      description: "A reported nonnegative integer, including zero.",
      valid: (order) => validCount(order.metadata.chunkSummary?.success),
    },
    {
      key: "error",
      label: "Error chunk count",
      description:
        "A reported nonnegative integer, including zero. This is not a complete retry-attempt log.",
      valid: (order) => validCount(order.metadata.chunkSummary?.error),
    },
    {
      key: "source",
      label: "Source attribution",
      description: "The list record identifies the order service that returned it.",
      valid: (order) => order.source === "v1" || order.source === "v2",
    },
  ];
  const fields = checks.map((check) => {
    const missing = orders.filter((order) => !check.valid(order));
    return { ...check, missing, present: orders.length - missing.length };
  });
  const unattributed = orders.filter(
    (order) =>
      !configured.has(
        `${getTwapOrderChainId(order)}:${order.exchangeAdapter?.toLowerCase()}`,
      ),
  );
  const excessProgress = orders.filter((order) => {
    const expected = reportedNumber(order.metadata.expectedChunks);
    const success = reportedNumber(order.metadata.chunkSummary?.success);
    return (
      expected !== undefined &&
      expected > 0 &&
      success !== undefined &&
      success > expected
    );
  });
  const statusConflicts = orders.filter(
    (order) => getOrderStatusConflict(order) !== undefined,
  );
  const identities = new Map<string, ListOrder[]>();
  for (const order of orders) {
    if (!hash.test(order.hash ?? "")) continue;
    const key = `${getTwapOrderChainId(order)}:${order.hash.toLowerCase()}`;
    const group = identities.get(key) ?? [];
    group.push(order);
    identities.set(key, group);
  }
  const duplicates = [...identities.values()]
    .filter((group) => group.length > 1)
    .flat();
  const flagged = new Set([
    ...fields.flatMap((field) => field.missing),
    ...excessProgress,
    ...duplicates,
    ...statusConflicts,
  ]);
  const sources = ["v2", "v1", "Not provided"]
    .map((source) => {
      const records = orders.filter(
        (order) => (order.source ?? "Not provided") === source,
      );
      const timestamps = records
        .map((order) => Date.parse(order.timestamp))
        .filter(
          (time) => Number.isFinite(time) && time > 0 && time <= snapshot,
        );
      return {
        source,
        orders: records,
        priced: records.filter(
          (order) => reportedNumber(order.totalUSDAmount) !== undefined,
        ).length,
        latest: timestamps.length
          ? timestamps.reduce((latest, time) => Math.max(latest, time), 0)
          : undefined,
      };
    })
    .filter((source) => source.orders.length);
  return {
    fields,
    flagged: [...flagged],
    unattributed,
    excessProgress,
    duplicates,
    statusConflicts,
    sources,
  };
}
