import type { ListOrder, SpotConfig } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import {
  addressFormat,
  buildAdapterRegistry,
  isZeroAddress,
  matchAdapter,
  type AdapterMatch,
  type AddressFormat,
} from "./adapter-registry";
export { addressFormat, isZeroAddress } from "./adapter-registry";
export type { AdapterMatch, AddressFormat } from "./adapter-registry";

const MINUTE = 60_000;
export const SECURITY_RULES = {
  lookback: 24 * 60 * MINUTE,
  burstWindow: 5 * MINUTE,
  baselineWindow: 60 * MINUTE,
  burstMinimum: 20,
  burstMultiplier: 5,
  failureWindow: 15 * MINUTE,
  failureMinimum: 5,
  failureShare: 0.8,
} as const;

export type DashboardAccess = "google" | "local" | "disabled";

export function checkSecurityAddress(
  address: string,
  chainId: number | undefined,
  config: SpotConfig | null,
) {
  return {
    format: addressFormat(address),
    zero: isZeroAddress(address),
    ...matchAdapter(address, chainId, buildAdapterRegistry(config)),
  };
}

export type SecurityCluster = {
  key: string;
  chainId: number | undefined;
  adapter: string;
  start: number;
  orders: ListOrder[];
  failed: number;
  baseline?: number;
};
export type SecurityFinding = {
  key: string;
  label: string;
  description: string;
  orders: ListOrder[];
  available: boolean;
};

function lowerBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function buildSecurityReview(
  orders: ListOrder[],
  snapshot: number,
  config: SpotConfig | null,
) {
  const registry = buildAdapterRegistry(config);
  const invalidAddresses: ListOrder[] = [];
  const unmatched: ListOrder[] = [];
  const missingNetwork: ListOrder[] = [];
  const missingTime: ListOrder[] = [];
  const inventory = new Map<
    string,
    {
      key: string;
      chainId: number | undefined;
      address: string;
      format: AddressFormat;
      match: AdapterMatch;
      names: string[];
      knownNetworks: number[];
      orders: ListOrder[];
    }
  >();
  const grouped = new Map<string, { order: ListOrder; time: number }[]>();
  let firstTime = Infinity;
  for (const order of orders) {
    const chainId = getTwapOrderChainId(order);
    if (!chainId) missingNetwork.push(order);
    const adapter = order.exchangeAdapter ?? "";
    const format = addressFormat(adapter);
    const match = matchAdapter(adapter, chainId, registry);
    if (
      format !== "valid" ||
      isZeroAddress(adapter) ||
      addressFormat(order.inputToken) !== "valid" ||
      addressFormat(order.outputToken) !== "valid"
    )
      invalidAddresses.push(order);
    if (
      format === "valid" &&
      !isZeroAddress(adapter) &&
      (match.match === "unknown" || match.match === "other-network")
    )
      unmatched.push(order);
    const key = `${chainId}:${adapter.toLowerCase()}`;
    const item = inventory.get(key) ?? {
      key,
      chainId,
      address: adapter,
      format,
      ...match,
      orders: [],
    };
    item.orders.push(order);
    inventory.set(key, item);
    const time = Date.parse(order.timestamp);
    if (!Number.isFinite(time) || time <= 0 || time > snapshot) {
      missingTime.push(order);
      continue;
    }
    firstTime = Math.min(firstTime, time);
    // A missing chain or invalid adapter cannot identify an activity cohort.
    if (!chainId || format !== "valid" || isZeroAddress(adapter)) continue;
    const group = grouped.get(key) ?? [];
    group.push({ order, time });
    grouped.set(key, group);
  }
  const bursts: SecurityCluster[] = [];
  const failures: SecurityCluster[] = [];
  let baselineSkipped = 0;
  for (const [key, records] of grouped) {
    const times = records.map((record) => record.time).sort((a, b) => a - b);
    const buckets = (window: number) => {
      const result = new Map<number, ListOrder[]>();
      for (const record of records) {
        const start = Math.floor(record.time / window) * window;
        // Only wholly in-scope buckets are evaluated at the lookback boundary.
        if (start < snapshot - SECURITY_RULES.lookback) continue;
        const orders = result.get(start) ?? [];
        orders.push(record.order);
        result.set(start, orders);
      }
      return result;
    };
    for (const [start, orders] of buckets(SECURITY_RULES.burstWindow)) {
      if (orders.length < SECURITY_RULES.burstMinimum) continue;
      const baselineStart = start - SECURITY_RULES.baselineWindow;
      if (firstTime > baselineStart) {
        baselineSkipped++;
        continue;
      }
      const baseline =
        (lowerBound(times, start) - lowerBound(times, baselineStart)) /
        (SECURITY_RULES.baselineWindow / SECURITY_RULES.burstWindow);
      if (
        orders.length >=
        SECURITY_RULES.burstMultiplier * Math.max(1, baseline)
      )
        bursts.push({
          key: `${key}:${start}`,
          chainId: getTwapOrderChainId(orders[0]),
          adapter: orders[0].exchangeAdapter,
          start,
          orders,
          failed: 0,
          baseline,
        });
    }
    for (const [start, orders] of buckets(SECURITY_RULES.failureWindow)) {
      const failed = orders.filter(
        (order) => getOverviewOrderStatus(order) === "failed",
      ).length;
      if (
        failed >= SECURITY_RULES.failureMinimum &&
        failed / orders.length >= SECURITY_RULES.failureShare
      )
        failures.push({
          key: `${key}:${start}`,
          chainId: getTwapOrderChainId(orders[0]),
          adapter: orders[0].exchangeAdapter,
          start,
          orders,
          failed,
        });
    }
  }
  bursts.sort((a, b) => b.start - a.start);
  failures.sort((a, b) => b.start - a.start);
  const unique = (clusters: SecurityCluster[]) => [
    ...new Set(clusters.flatMap((cluster) => cluster.orders)),
  ];
  const findings: SecurityFinding[] = [
    {
      key: "addresses",
      label: "Address format issues",
      description:
        "Missing, malformed, or invalid mixed-case checksums in adapters or token addresses; zero adapters are flagged. Native zero token addresses are accepted.",
      orders: invalidAddresses,
      available: true,
    },
    {
      key: "adapters",
      label: "Unmatched adapter addresses",
      description:
        "Adapter and network pairs absent from the loaded configuration and service catalogs, including addresses known only on another network.",
      orders: unmatched,
      available: registry.available,
    },
    {
      key: "bursts",
      label: "Unusual order bursts",
      description:
        "At least 20 orders in a UTC 5-minute bucket and at least 5× the preceding hour’s average per 5 minutes for the same adapter and network. Only the last 24 hours are checked.",
      orders: unique(bursts),
      available:
        orders.length > 0 &&
        firstTime <= snapshot - SECURITY_RULES.baselineWindow,
    },
    {
      key: "failures",
      label: "Concentrated order failures",
      description:
        "At least 5 terminal failed orders and an 80% failure rate in a UTC 15-minute bucket for one adapter and network, in the last 24 hours. Normal execution problems can also trigger this check.",
      orders: unique(failures),
      available: orders.length > 0 && missingTime.length < orders.length,
    },
  ];
  return {
    findings,
    bursts,
    failures,
    baselineSkipped,
    missingNetwork,
    missingTime,
    currentRegistrySize: registry.current.size,
    catalogAvailable: registry.available,
    flagged: [...new Set(findings.flatMap((finding) => finding.orders))],
    inventory: [...inventory.values()].sort(
      (a, b) => b.orders.length - a.orders.length || a.key.localeCompare(b.key),
    ),
    currentOrders: orders.filter(
      (order) =>
        matchAdapter(
          order.exchangeAdapter ?? "",
          getTwapOrderChainId(order),
          registry,
        ).match === "current",
    ),
    catalogOrders: orders.filter(
      (order) =>
        matchAdapter(
          order.exchangeAdapter ?? "",
          getTwapOrderChainId(order),
          registry,
        ).match === "catalog",
    ),
  };
}
