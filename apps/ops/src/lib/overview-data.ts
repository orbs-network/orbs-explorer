import { PARTNERS } from "@orbs/domain/partners";
import type { ListOrder, SpotConfig } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  filterOverviewOrders,
  getPartnerChainPairs,
  getPartnerByAdapter,
  ordersToPartnerStats,
  partnerChainKey,
  type PartnerCard,
  type PartnerChainEntry,
} from "@orbs/domain/twap/utils/orders-overview";
import {
  getChainName,
  getChains,
  getChainLogo,
} from "@orbs/domain/utils/utils";
import type { ActivityExpectationPartner } from "./overview-monitoring";

const partnerAliases = new Map(
  PARTNERS.flatMap((partner) =>
    [partner.id, ...partner.identifiers].map(
      (alias) => [alias.toLowerCase(), partner] as const,
    ),
  ),
);
const canonicalId = (id: string) =>
  partnerAliases.get(id.toLowerCase())?.id ?? id;
const adapterAddress = (order: ListOrder): string =>
  typeof order.exchangeAdapter === "string" && order.exchangeAdapter.trim()
    ? order.exchangeAdapter
    : "";

export function buildSpotOverview({
  allOrders,
  config,
  updatedAt,
  days,
  chainIds = [],
  partnerIds = [],
}: {
  allOrders: ListOrder[];
  config: SpotConfig | null;
  updatedAt: number;
  days?: number;
  chainIds?: string[];
  partnerIds?: string[];
}) {
  const pairs = getPartnerChainPairs(config).map((pair) => ({
    ...pair,
    partnerId: canonicalId(pair.partnerId),
    partnerName:
      partnerAliases.get(pair.partnerId.toLowerCase())?.name ??
      pair.partnerName,
  }));
  const byAdapter = new Map<string, (typeof pairs)[number] | null>();
  for (const pair of pairs) {
    const key = `${pair.chainId}:${pair.adapter.toLowerCase()}`;
    const previous = byAdapter.get(key);
    byAdapter.set(
      key,
      previous === null || (previous && previous.partnerId !== pair.partnerId)
        ? null
        : pair,
    );
  }
  const chains = new Map<number, ReturnType<typeof getChains>[number]>(
    getChains().map((chain) => [chain.id, chain]),
  );
  const networkName = (id: number) =>
    chains.get(id)?.name ??
    getChainName(id) ??
    (id ? `Network ${id}` : "Network not provided");
  const resolvePartner = (order: ListOrder) =>
    byAdapter.get(
      `${getTwapOrderChainId(order)}:${adapterAddress(order).toLowerCase()}`,
    );
  const partnerId = (order: ListOrder) =>
    resolvePartner(order)?.partnerId ??
    `adapter-${adapterAddress(order).toLowerCase()}`;
  const catalog = new Map<string, { value: string; label: string }>(
    PARTNERS.map((partner) => [
      partner.id,
      { value: partner.id, label: partner.name },
    ]),
  );
  const partnerNetworks = new Map<string, Set<number>>();
  const observedUnknownPartners = new Set<string>();
  const networkIds = new Set<number>();
  const lastOrderByPartner: Record<string, number> = Object.create(null);
  const addNetwork = (id: string, chainId: number) => {
    const networks = partnerNetworks.get(id) ?? new Set<number>();
    networks.add(chainId);
    partnerNetworks.set(id, networks);
    networkIds.add(chainId);
  };
  for (const pair of pairs) {
    catalog.set(pair.partnerId, {
      value: pair.partnerId,
      label: pair.partnerName,
    });
    addNetwork(pair.partnerId, pair.chainId);
  }
  // Historical partners and networks stay visible even when this period has no orders.
  for (const order of allOrders) {
    const id = partnerId(order);
    const address = adapterAddress(order);
    const chainId = getTwapOrderChainId(order) ?? 0;
    if (id.startsWith("adapter-")) observedUnknownPartners.add(id);
    if (!catalog.has(id))
      catalog.set(id, {
        value: id,
        label:
          resolvePartner(order)?.partnerName ??
          (address
            ? `Unidentified app (${address.slice(0, 6)}…${address.slice(-4)})`
            : "Unidentified app (address not provided)"),
      });
    addNetwork(id, chainId);
    const placed = Date.parse(order.timestamp);
    if (
      Number.isFinite(placed) &&
      placed > 0 &&
      placed <= updatedAt &&
      (!chainIds.length || chainIds.includes(String(chainId)))
    )
      lastOrderByPartner[id] = Math.max(lastOrderByPartner[id] ?? 0, placed);
  }
  const selectedPartners = new Set(
    partnerIds.map((value) => {
      const id = canonicalId(value);
      // An adapter can be known on one network and unidentified on another.
      // Preserve that observed identity across period and network filters; only
      // resolve an old bookmark when no unknown cohort remains in the snapshot.
      if (observedUnknownPartners.has(id.toLowerCase()))
        return id.toLowerCase();
      return id.toLowerCase().startsWith("adapter-")
        ? (getPartnerByAdapter(
            config,
            id.slice("adapter-".length),
            chainIds.length ? chainIds.map(Number) : undefined,
          )?.partnerId ?? id)
        : id;
    }),
  );
  const orders = filterOverviewOrders(allOrders, {
    days,
    updatedAt,
    chainIds,
    partnerIds: [...selectedPartners],
    resolvePartner: partnerId,
  });
  const ordersByPartnerChain = new Map<string, ListOrder[]>();
  for (const order of orders) {
    const key = partnerChainKey(
      partnerId(order),
      getTwapOrderChainId(order) ?? 0,
    );
    const group = ordersByPartnerChain.get(key) ?? [];
    group.push(order);
    ordersByPartnerChain.set(key, group);
  }
  const activePartnerIds = new Set(orders.map(partnerId));
  const partnerCards: PartnerCard[] = [];
  const activityPartners: ActivityExpectationPartner[] = [];
  for (const partner of catalog.values()) {
    if (selectedPartners.size && !selectedPartners.has(partner.value)) continue;
    const networks = [...(partnerNetworks.get(partner.value) ?? [])].filter(
      (id) => !chainIds.length || chainIds.includes(String(id)),
    );
    if (chainIds.length && !networks.length) continue;
    activityPartners.push({
      partnerId: partner.value,
      partnerName: partner.label,
      chainIds: networks.map(String),
    });
    if (
      partner.value.startsWith("adapter-") &&
      !activePartnerIds.has(partner.value) &&
      !selectedPartners.has(partner.value)
    )
      continue;
    partnerCards.push({
      partnerId: partner.value,
      partnerName: partner.label,
      chains: networks
        .map((chainId) => {
          const chainOrders =
            ordersByPartnerChain.get(partnerChainKey(partner.value, chainId)) ??
            [];
          const chainName = networkName(chainId);
          return {
            chainId,
            chainName,
            orders: chainOrders,
            stats: ordersToPartnerStats(
              chainOrders,
              partner.value,
              partner.label,
              { chainId, chainName },
            ),
            topPairs: [],
          };
        })
        .sort(
          (a, b) =>
            b.stats.totalOrders - a.stats.totalOrders ||
            a.chainName.localeCompare(b.chainName),
        ),
    });
  }
  const totalOrders = (card: PartnerCard) =>
    card.chains.reduce((sum, chain) => sum + chain.orders.length, 0);
  partnerCards.sort(
    (a, b) =>
      totalOrders(b) - totalOrders(a) ||
      a.partnerName.localeCompare(b.partnerName),
  );
  const networkGroups = new Map<number, ListOrder[]>();
  for (const card of partnerCards) {
    for (const chain of card.chains) {
      const group = networkGroups.get(chain.chainId) ?? [];
      group.push(...chain.orders);
      networkGroups.set(chain.chainId, group);
    }
  }
  const networkActivity: PartnerChainEntry[] = [...networkGroups]
    .map(([chainId, chainOrders]) => ({
      chainId,
      chainName: networkName(chainId),
      orders: chainOrders,
      stats: ordersToPartnerStats(chainOrders, "all", "All trading apps", {
        chainId,
        chainName: networkName(chainId),
      }),
      topPairs: [],
    }))
    .sort(
      (a, b) =>
        b.orders.length - a.orders.length ||
        a.chainName.localeCompare(b.chainName),
    );
  return {
    orders,
    selectedPartnerIds: [...selectedPartners],
    lastOrderByPartner,
    activityPartners,
    partnerCards,
    networkActivity,
    stats: partnerCards.flatMap((card) =>
      card.chains.map((chain) => chain.stats),
    ),
    networkOptions: [...networkIds]
      .map((id) => ({
        value: String(id),
        chainId: id,
        label: networkName(id),
        logo: getChainLogo(id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    partnerOptions: [...catalog.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  };
}
