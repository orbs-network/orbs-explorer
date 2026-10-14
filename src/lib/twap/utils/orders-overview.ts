import type { ListOrder } from "../types";
import { PARTNERS } from "../../partners";
import { Partners } from "../../types";

type SpotConfig = Record<
  string,
  { dex?: Record<string, { adapter?: string }> }
>;

export const OVERVIEW_STATUSES = {
  completed: {
    label: "Completed",
    description: "All planned trades are reported complete.",
  },
  partial: {
    label: "Partly completed",
    description: "The order ended after some of its planned trades completed.",
  },
  active: {
    label: "Active",
    description:
      "Still waiting for a price condition, a scheduled time, or another execution attempt.",
  },
  cancelled: {
    label: "Cancelled",
    description:
      "Cancelled orders can still have completed trades in their history.",
  },
  expired: {
    label: "Expired",
    description: "The expiry time passed before all planned trades completed.",
  },
  failed: {
    label: "Failed",
    description:
      "The order stopped because execution could not complete. Open it to see the reason.",
  },
  unknown: {
    label: "Other status",
    description:
      "The service returned an unrecognized status. Open the order for its latest update.",
  },
} as const;
export type OverviewOrderStatus = keyof typeof OVERVIEW_STATUSES;

export function getListOrderStatus(order: ListOrder): string {
  return order.metadata?.status ?? "";
}

export function getOverviewOrderStatus(order: ListOrder): OverviewOrderStatus {
  const raw = getListOrderStatus(order).toLowerCase();
  const display = (order.metadata?.displayOnlyStatus ?? "").toUpperCase();
  if (raw === "cancelled" || display === "CANCELLED") return "cancelled";
  if (raw === "expired" || display === "EXPIRED") return "expired";
  if (raw === "completed" || display === "SUCCEEDED") return "completed";
  if (raw === "partially_completed" || display === "PARTIALLY SUCCEEDED")
    return "partial";
  // An unsuccessful attempt does not end an order that is still active.
  if (
    raw === "pending" ||
    raw === "eligible" ||
    display === "PENDING" ||
    display === "PENDING-PRICE-CHECK"
  )
    return "active";
  if (
    raw === "failed" ||
    raw === "error" ||
    display === "FAILED" ||
    display === "ERROR"
  )
    return "failed";
  return "unknown";
}
export const isListOrderCompleted = (order: ListOrder) =>
  getOverviewOrderStatus(order) === "completed";
export const isListOrderPartiallyCompleted = (order: ListOrder) =>
  getOverviewOrderStatus(order) === "partial";
export const isListOrderPending = (order: ListOrder) =>
  getOverviewOrderStatus(order) === "active";
export const isListOrderError = (order: ListOrder) =>
  getOverviewOrderStatus(order) === "failed";
export const classifyListOrderStatus = getOverviewOrderStatus;

export function getOrderValueUsd(order: ListOrder): number {
  const value = Number(order.totalUSDAmount);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function groupOverviewOrders(
  orders: ListOrder[],
): Record<OverviewOrderStatus, ListOrder[]> {
  const grouped: Record<OverviewOrderStatus, ListOrder[]> = {
    completed: [],
    partial: [],
    active: [],
    cancelled: [],
    expired: [],
    failed: [],
    unknown: [],
  };
  for (const order of orders)
    grouped[getOverviewOrderStatus(order)].push(order);
  return grouped;
}

export type PartnerStats = {
  partnerId: string;
  partnerName: string;
  chainId?: number;
  chainName?: string;
  totalOrders: number;
  totalUsd: number;
  filledOrders: number;
  filledUsd: number;
  partiallyFilledOrders: number;
  partiallyFilledUsd: number;
  errorOrders: number;
  errorUsd: number;
  pendingOrders: number;
  pendingUsd: number;
  cancelledOrders: number;
  cancelledUsd: number;
  expiredOrders: number;
  expiredUsd: number;
  unknownOrders: number;
  unknownUsd: number;
};

export type PartnerWithAdapter = {
  partnerId: string;
  partnerName: string;
  adapter: string;
};

export type PartnerChainPair = {
  partnerId: string;
  partnerName: string;
  adapter: string;
  chainId: number;
};

function getPartnerName(partnerId: string): string {
  let id = partnerId;
  if (id === "spooky") id = Partners.Spookyswap;
  const p = PARTNERS.find((item) => item.id.toLowerCase() === id.toLowerCase());
  return p?.name ?? formatPartnerId(partnerId);
}

function formatPartnerId(partnerId: string): string {
  return partnerId.charAt(0).toUpperCase() + partnerId.slice(1).toLowerCase();
}

export function getPartnersWithAdapters(
  config: SpotConfig | null,
): PartnerWithAdapter[] {
  if (!config) return [];
  const byAdapter = new Map<string, PartnerWithAdapter>();

  for (const chainConfig of Object.values(config)) {
    if (!chainConfig?.dex) continue;
    for (const [partnerId, dexConfig] of Object.entries(chainConfig.dex)) {
      if (typeof dexConfig === "object" && dexConfig.adapter) {
        const adapter = dexConfig.adapter.toLowerCase();
        if (!byAdapter.has(adapter)) {
          byAdapter.set(adapter, {
            partnerId,
            partnerName: getPartnerName(partnerId),
            adapter: dexConfig.adapter,
          });
        }
      }
    }
  }

  return Array.from(byAdapter.values());
}

export function getPartnerChainPairs(
  config: SpotConfig | null,
): PartnerChainPair[] {
  if (!config) return [];
  const pairs: PartnerChainPair[] = [];

  for (const [chainIdStr, chainConfig] of Object.entries(config)) {
    const chainId = Number(chainIdStr);
    if (Number.isNaN(chainId) || !chainConfig?.dex) continue;
    for (const [partnerId, dexConfig] of Object.entries(chainConfig.dex)) {
      if (typeof dexConfig === "object" && dexConfig.adapter) {
        pairs.push({
          partnerId,
          partnerName: getPartnerName(partnerId),
          adapter: dexConfig.adapter,
          chainId,
        });
      }
    }
  }

  return pairs;
}

export function partnerChainKey(partnerId: string, chainId: number): string {
  return `${partnerId}-${chainId}`;
}

export type TopPair = {
  inputToken: string;
  outputToken: string;
  totalUsd: number;
  orderCount: number;
};

export type PartnerChainEntry = {
  chainId: number;
  chainName: string;
  stats: PartnerStats;
  orders: ListOrder[];
  topPairs: TopPair[];
};

export type PartnerCard = {
  partnerId: string;
  partnerName: string;
  chains: PartnerChainEntry[];
};

export function getPartnerByAdapter(
  config: SpotConfig | null,
  adapter: string,
): { partnerId: string; partnerName: string } | null {
  if (!config || !adapter) return null;
  const target = adapter.toLowerCase();

  for (const chainConfig of Object.values(config)) {
    if (!chainConfig?.dex) continue;
    for (const [partnerId, dexConfig] of Object.entries(chainConfig.dex)) {
      if (
        typeof dexConfig === "object" &&
        dexConfig.adapter?.toLowerCase() === target
      ) {
        return {
          partnerId,
          partnerName: getPartnerName(partnerId),
        };
      }
    }
  }
  return null;
}

export function aggregateOrdersByPartner(
  orders: ListOrder[],
  config: SpotConfig | null,
  sinceDate: Date,
): PartnerStats[] {
  const filtered = orders.filter(
    (o) => new Date(o.timestamp).getTime() >= sinceDate.getTime(),
  );

  const groups = new Map<string, { name: string; orders: ListOrder[] }>();
  for (const order of filtered) {
    const resolved = getPartnerByAdapter(config, order.exchangeAdapter);
    const key = resolved?.partnerId ?? order.exchangeAdapter.toLowerCase();
    const group = groups.get(key) ?? {
      name:
        resolved?.partnerName ??
        `Unknown app (${order.exchangeAdapter.slice(0, 6)}…)`,
      orders: [],
    };
    group.orders.push(order);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) =>
    ordersToPartnerStats(group.orders, key, group.name),
  );
}

export function getLast7DaysDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getTopPairsByVolume(orders: ListOrder[], limit = 3): TopPair[] {
  const byPair = new Map<
    string,
    {
      inputToken: string;
      outputToken: string;
      totalUsd: number;
      orderCount: number;
    }
  >();

  for (const order of orders) {
    const inAddr = (order.inputToken ?? "").toLowerCase();
    const outAddr = (order.outputToken ?? "").toLowerCase();
    if (!inAddr || !outAddr) continue;
    const pairKey = `${inAddr}-${outAddr}`;
    const usd = getOrderValueUsd(order);

    const existing = byPair.get(pairKey);
    if (existing) {
      existing.totalUsd += usd;
      existing.orderCount += 1;
    } else {
      byPair.set(pairKey, {
        inputToken: inAddr,
        outputToken: outAddr,
        totalUsd: usd,
        orderCount: 1,
      });
    }
  }

  return Array.from(byPair.values())
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, limit);
}

export function ordersToPartnerStats(
  orders: ListOrder[],
  partnerId: string,
  partnerName: string,
  options?: { chainId?: number; chainName?: string },
): PartnerStats {
  const groups = groupOverviewOrders(orders);
  const value = (key: OverviewOrderStatus) =>
    groups[key].reduce((sum, order) => sum + getOrderValueUsd(order), 0);
  return {
    partnerId,
    partnerName,
    ...options,
    totalOrders: orders.length,
    totalUsd: orders.reduce((sum, order) => sum + getOrderValueUsd(order), 0),
    filledOrders: groups.completed.length,
    filledUsd: value("completed"),
    partiallyFilledOrders: groups.partial.length,
    partiallyFilledUsd: value("partial"),
    pendingOrders: groups.active.length,
    pendingUsd: value("active"),
    errorOrders: groups.failed.length,
    errorUsd: value("failed"),
    cancelledOrders: groups.cancelled.length,
    cancelledUsd: value("cancelled"),
    expiredOrders: groups.expired.length,
    expiredUsd: value("expired"),
    unknownOrders: groups.unknown.length,
    unknownUsd: value("unknown"),
  };
}

export function filterOverviewOrders(
  orders: ListOrder[],
  {
    days,
    updatedAt,
    chainIds = [],
    partnerIds = [],
    resolvePartner,
  }: {
    days?: number;
    updatedAt: number;
    chainIds?: string[];
    partnerIds?: string[];
    resolvePartner: (order: ListOrder) => string;
  },
): ListOrder[] {
  const since = days ? updatedAt - days * 24 * 60 * 60 * 1000 : undefined;
  return orders.filter((order) => {
    const chainId =
      order.order.witness.chainId ?? order.order.witness.chainid ?? 0;
    return (
      (!since || Date.parse(order.timestamp) >= since) &&
      (!chainIds.length || chainIds.includes(String(chainId))) &&
      (!partnerIds.length || partnerIds.includes(resolvePartner(order)))
    );
  });
}
