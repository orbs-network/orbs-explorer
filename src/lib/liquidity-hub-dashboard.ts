import { PARTNERS } from "./partners";
import { LIQUIDITY_HUB_PARTNER_CHAINS } from "./liquidity-hub/partner-chains";
import type { LiquidityHubSwap } from "./liquidity-hub/types";
import type { Partners } from "./types";

export type LHPartnerStats = {
  partnerId: string;
  partnerName: string;
  totalSwaps: number;
  totalUsd: number;
  successSwaps: number;
  failedSwaps: number;
};

export type LHPartnerWithId = {
  partnerId: string;
  partnerName: string;
};

function getPartnerName(partnerId: string): string {
  const id = partnerId.toLowerCase();
  const p = PARTNERS.find(
    (item) =>
      item.id.toLowerCase() === id || item.identifiers.some((i) => i.toLowerCase() === id)
  );
  return p?.name ?? partnerId;
}

/** List of partners that have Liquidity Hub (from partner-chains). */
export function getLHPartners(): LHPartnerWithId[] {
  const ids = Object.keys(LIQUIDITY_HUB_PARTNER_CHAINS) as Partners[];
  return ids.map((id) => ({
    partnerId: id,
    partnerName: getPartnerName(id),
  }));
}

function isSuccessSwap(swap: LiquidityHubSwap): boolean {
  const s = (swap.swapStatus ?? "").toLowerCase();
  return s === "success" || s === "succeeded";
}

/** Aggregate swaps for a single partner into LHPartnerStats. */
export function swapsToPartnerStats(
  swaps: LiquidityHubSwap[],
  partnerId: string,
  partnerName: string
): LHPartnerStats {
  let totalUsd = 0;
  let success = 0;
  let failed = 0;
  for (const swap of swaps) {
    const usd = swap.amountInUSD ?? swap.dollarValue2 ?? 0;
    totalUsd += typeof usd === "number" ? usd : 0;
    if (isSuccessSwap(swap)) success += 1;
    else failed += 1;
  }
  return {
    partnerId,
    partnerName,
    totalSwaps: swaps.length,
    totalUsd,
    successSwaps: success,
    failedSwaps: failed,
  };
}

/** Match swap to partner by dex (dex can be partner id or identifier). */
export function swapBelongsToPartner(swap: LiquidityHubSwap, partnerId: string): boolean {
  const dex = (swap.dex ?? "").toLowerCase();
  const p = PARTNERS.find(
    (item) =>
      item.id.toLowerCase() === partnerId.toLowerCase() ||
      item.identifiers.some((i) => i.toLowerCase() === partnerId.toLowerCase())
  );
  if (!p) return dex === partnerId.toLowerCase();
  return p.id.toLowerCase() === dex || p.identifiers.some((i) => i.toLowerCase() === dex);
}

export function getLast7DaysDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
