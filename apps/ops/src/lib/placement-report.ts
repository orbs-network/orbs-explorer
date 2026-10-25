import type { ListOrder, SpotConfig } from "@orbs/domain/twap/types";
import {
  getOrderValueUsd,
  type PartnerCard,
} from "@orbs/domain/twap/utils/orders-overview";
import { buildSpotOverview } from "./overview-data";
import { reportedNumber } from "./order-diagnostics";

const DAY = 86_400_000;

export function summarizePlacements(cards: readonly PartnerCard[]) {
  const orders = cards.flatMap((card) =>
    card.chains.flatMap((chain) => chain.orders),
  );
  const pricedOrders = orders.filter(
    (order) => reportedNumber(order.totalUSDAmount) !== undefined,
  ).length;
  return {
    orders: orders.length,
    placedUsd:
      pricedOrders || !orders.length
        ? orders.reduce((sum, order) => sum + getOrderValueUsd(order), 0)
        : undefined,
    pricedOrders,
    apps: cards.filter((card) =>
      card.chains.some((chain) => chain.orders.length),
    ).length,
  };
}

/** Compare equal rolling placement windows from the same complete cached snapshot.
 * Previous excludes the shared boundary; unknown dates cannot enter either range.
 * No fill amounts, wallet identities or trading-volume estimates are inferred.
 */
export function buildPlacementReport({
  allOrders,
  config,
  updatedAt,
  days,
  chainIds,
  partnerIds,
  currentCards,
}: {
  allOrders: ListOrder[];
  config: SpotConfig | null;
  updatedAt: number;
  days?: number;
  chainIds: string[];
  partnerIds: string[];
  currentCards: PartnerCard[];
}) {
  const current = summarizePlacements(currentCards);
  const start = days ? updatedAt - days * DAY : undefined;
  const previousStart =
    days && start !== undefined ? start - days * DAY : undefined;
  // Resolve adapter identity using the complete catalog/history. An adapter
  // unidentified on one network must not resolve to a known app on another.
  const history = days
    ? buildSpotOverview({ allOrders, config, updatedAt, chainIds, partnerIds })
    : undefined;
  const previousCards =
    history && previousStart !== undefined && start !== undefined
      ? history.partnerCards.map((card) => ({
          ...card,
          chains: card.chains.map((chain) => ({
            ...chain,
            orders: chain.orders.filter((order) => {
              const placed = Date.parse(order.timestamp);
              return (
                Number.isFinite(placed) &&
                placed > 0 &&
                placed >= previousStart &&
                placed < start
              );
            }),
          })),
        }))
      : undefined;
  return {
    current,
    previous: previousCards ? summarizePlacements(previousCards) : undefined,
    previousCards,
    start,
    end: updatedAt,
    previousStart,
    days,
  };
}

export type PlacementReport = ReturnType<typeof buildPlacementReport>;

export function placementChange(
  current: number | undefined,
  previous: number | undefined,
): string {
  if (current === undefined || previous === undefined) return "Unavailable";
  if (!previous) return current ? "New" : "No change";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(change)}%`;
}

export function reportWindow(start: number | undefined, end: number): string {
  if (!Number.isFinite(end) || end <= 0) return "Snapshot time unavailable";
  return `${start === undefined ? "All available history" : new Date(start).toISOString().replace("T", " ").slice(0, 16)} → ${new Date(end).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
