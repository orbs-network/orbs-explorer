import { ListOrder } from "./types";
import { PARTNERS } from "./partners";
import { Partners, Status } from "./types";

/** Raw status string from ListOrder.metadata.status. */
export function getListOrderStatus(order: ListOrder): string {
  return order.metadata?.status ?? "";
}

export function isListOrderCompleted(order: ListOrder): boolean {
  return getListOrderStatus(order) === Status.COMPLETED;
}

export function isListOrderPartiallyCompleted(order: ListOrder): boolean {
  return getListOrderStatus(order) === Status.PARTIALLY_COMPLETED;
}

export function isListOrderPending(order: ListOrder): boolean {
  return getListOrderStatus(order) === Status.PENDING;
}

export function isListOrderError(order: ListOrder): boolean {
  const s = getListOrderStatus(order);
  return (
    s !== Status.COMPLETED &&
    s !== Status.PARTIALLY_COMPLETED &&
    s !== Status.PENDING
  );
}

/** Classify order for aggregation. */
export function classifyListOrderStatus(order: ListOrder): Status {
  const s = getListOrderStatus(order);
  if (s === Status.COMPLETED) return Status.COMPLETED;
  if (s === Status.PARTIALLY_COMPLETED) return Status.PARTIALLY_COMPLETED;
  if (s === Status.PENDING) return Status.PENDING;
  return Status.FAILED;
}

export type PartnerStats = {
  partnerId: string;
  partnerName: string;
  /** When set, card is for this partner on this chain (e.g. "Pangolin Monad") */
  chainId?: number;
  chainName?: string;
  totalOrders: number;
  totalUsd: number;
  filledOrders: number;
  partiallyFilledOrders: number;
  errorOrders: number;
  pendingOrders: number;
};

type SpotConfig = Record<
  string,
  { dex?: Record<string, { adapter?: string }> }
>;

export type PartnerWithAdapter = {
  partnerId: string;
  partnerName: string;
  adapter: string;
};

/** One card per partner per chain (e.g. Pangolin Monad, Pangolin Avalanche). */
export type PartnerChainPair = {
  partnerId: string;
  partnerName: string;
  adapter: string;
  chainId: number;
};

export function getPartnersWithAdapters(
  config: SpotConfig | null
): PartnerWithAdapter[] {
  if (!config) return [];
  const byAdapter = new Map<string, PartnerWithAdapter>();

  for (const chainConfig of Object.values(config)) {
    if (!chainConfig?.dex) continue;
    for (const [partnerId, dexConfig] of Object.entries(chainConfig.dex)) {
      if (
        typeof dexConfig === "object" &&
        dexConfig.adapter
      ) {
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

/** Returns one entry per (partner, chain) for overview cards. */
export function getPartnerChainPairs(config: SpotConfig | null): PartnerChainPair[] {
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

/** Top pair by totalUSDAmount volume. */
export type TopPair = {
  inputToken: string;
  outputToken: string;
  totalUsd: number;
  orderCount: number;
};

/** One chain's stats + orders for use inside a partner card tab. */
export type PartnerChainEntry = {
  chainId: number;
  chainName: string;
  stats: PartnerStats;
  orders: ListOrder[];
  topPairs: TopPair[];
};

/** One card per partner: partner info + list of chains (each with stats + orders). */
export type PartnerCard = {
  partnerId: string;
  partnerName: string;
  chains: PartnerChainEntry[];
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

export function getPartnerByAdapter(
  config: SpotConfig | null,
  adapter: string
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
  sinceDate: Date
): PartnerStats[] {
  const filtered = orders.filter(
    (o) => new Date(o.timestamp).getTime() >= sinceDate.getTime()
  );

  const byPartner = new Map<
    string,
    {
      partnerName: string;
      totalOrders: number;
      totalUsd: number;
      filled: number;
      partiallyFilled: number;
      error: number;
      pending: number;
    }
  >();

  for (const order of filtered) {
    const resolved = getPartnerByAdapter(config, order.exchangeAdapter);
    const key = resolved?.partnerId ?? order.exchangeAdapter.toLowerCase();
    const name =
      resolved?.partnerName ?? `Adapter ${order.exchangeAdapter.slice(0, 10)}…`;

    if (!byPartner.has(key)) {
      byPartner.set(key, {
        partnerName: name,
        totalOrders: 0,
        totalUsd: 0,
        filled: 0,
        partiallyFilled: 0,
        error: 0,
        pending: 0,
      });
    }

    const row = byPartner.get(key)!;
    row.totalOrders += 1;
    const usd = parseFloat(order.totalUSDAmount) || 0;
    row.totalUsd += usd;

    const status = classifyListOrderStatus(order);
    if (status === Status.COMPLETED) row.filled += 1;
    else if (status === Status.PARTIALLY_COMPLETED) row.partiallyFilled += 1;
    else if (status === Status.PENDING) row.pending += 1;
    else row.error += 1;
  }

  return Array.from(byPartner.entries()).map(([partnerId, row]) => ({
    partnerId,
    partnerName: row.partnerName,
    totalOrders: row.totalOrders,
    totalUsd: row.totalUsd,
    filledOrders: row.filled,
    partiallyFilledOrders: row.partiallyFilled,
    errorOrders: row.error,
    pendingOrders: row.pending,
  }));
}

export function getLast7DaysDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Top N token pairs by totalUSDAmount volume. Uses canonical pair key (sorted addresses). */
export function getTopPairsByVolume(
  orders: ListOrder[],
  limit = 3
): TopPair[] {
  const byPair = new Map<
    string,
    { inputToken: string; outputToken: string; totalUsd: number; orderCount: number }
  >();

  for (const order of orders) {
    const inAddr = (order.inputToken ?? "").toLowerCase();
    const outAddr = (order.outputToken ?? "").toLowerCase();
    if (!inAddr || !outAddr) continue;
    const pairKey =
      inAddr < outAddr ? `${inAddr}-${outAddr}` : `${outAddr}-${inAddr}`;
    const first = inAddr < outAddr ? inAddr : outAddr;
    const second = inAddr < outAddr ? outAddr : inAddr;
    const usd = parseFloat(order.totalUSDAmount) || 0;

    const existing = byPair.get(pairKey);
    if (existing) {
      existing.totalUsd += usd;
      existing.orderCount += 1;
    } else {
      byPair.set(pairKey, {
        inputToken: first,
        outputToken: second,
        totalUsd: usd,
        orderCount: 1,
      });
    }
  }

  return Array.from(byPair.values())
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, limit);
}

/** Aggregate a single partner's orders into PartnerStats. Optionally include chain for card title "PartnerName ChainName". */
export function ordersToPartnerStats(
  orders: ListOrder[],
  partnerId: string,
  partnerName: string,
  options?: { chainId?: number; chainName?: string }
): PartnerStats {
  let totalUsd = 0;
  let filled = 0;
  let partiallyFilled = 0;
  let error = 0;
  let pending = 0;

  for (const order of orders) {
    totalUsd += parseFloat(order.totalUSDAmount) || 0;
    const status = classifyListOrderStatus(order);
    if (status === Status.COMPLETED) filled += 1;
    else if (status === Status.PARTIALLY_COMPLETED) partiallyFilled += 1;
    else if (status === Status.PENDING) pending += 1;
    else error += 1;
  }

  return {
    partnerId,
    partnerName,
    chainId: options?.chainId,
    chainName: options?.chainName,
    totalOrders: orders.length,
    totalUsd,
    filledOrders: filled,
    partiallyFilledOrders: partiallyFilled,
    errorOrders: error,
    pendingOrders: pending,
  };
}
