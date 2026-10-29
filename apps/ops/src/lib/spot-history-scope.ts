import type { SpotConfig } from "@orbs/domain/twap/types";
import { getPartnerChainPairs } from "@orbs/domain/twap/utils/orders-overview";
import { getSpotPartnerIdentity } from "@orbs/domain/twap/partner-catalog";
import { isAddress } from "viem";

/** Include current and historical adapters: a partner name alone can omit old deployments. */
export function historyExchangeForPartners(
  config: SpotConfig | null,
  partnerIds: string[],
  chainIds: string[] = [],
): string | undefined {
  if (!partnerIds.length) return undefined;
  const selected = new Set(
    partnerIds.map((id) => getSpotPartnerIdentity(id, config).partnerId),
  );
  const adapters = partnerIds.flatMap((id) => {
    const address = id.replace(/^adapter-/i, "");
    return isAddress(address, { strict: false }) ? [address.toLowerCase()] : [];
  });
  for (const pair of getPartnerChainPairs(config)) {
    if (
      (!chainIds.length || chainIds.includes(String(pair.chainId))) &&
      selected.has(getSpotPartnerIdentity(pair.partnerId, config).partnerId)
    )
      adapters.push(pair.adapter.toLowerCase());
  }
  // Unresolved catalog identities must retain the local filter rather than
  // sending a guessed partner name that could silently hide historical orders.
  return [...new Set(adapters)].sort().join(",") || undefined;
}
