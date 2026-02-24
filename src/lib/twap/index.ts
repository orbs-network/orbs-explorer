import { SpotConfig } from "../types";
import { getPartner } from "../lib";

const EMPTY_PARTNER = {
  chainId: 0,
  partner: null,
  config: null,
};
export const getSpotPartnerConfig = (
  config: SpotConfig,
  adapterOrPartnerId: string,
  partnerChainId: number,
) => {
  if (!adapterOrPartnerId || !config) return EMPTY_PARTNER;
  const target = adapterOrPartnerId.toLowerCase();

  for (const [chainId, chainConfig] of Object.entries(config)) {
    if (
      !chainConfig?.dex ||
      (partnerChainId && Number(chainId) !== partnerChainId)
    )
      continue;

    for (const [partner, dexConfig] of Object.entries(chainConfig.dex)) {
      if (
        (typeof dexConfig === "object" &&
          dexConfig.adapter?.toLowerCase() === target) ||
        partner.toLowerCase() === target
      ) {
        return {
          chainId: Number(chainId),
          partner: getPartner(partner),
          config: dexConfig,
        };
      }
    }
  }

  return EMPTY_PARTNER;
};
