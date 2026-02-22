import { useMemo } from "react";
import { useSpotConfig } from "../use-twap-config";
import { PARTNERS } from "@/lib/partners";

const getPartner = (partner: string) => {
  return PARTNERS.find((item) =>
    item.identifiers.some((i) => i.toLowerCase() === partner.toLowerCase()),
  );
};

const EMPTY_PARTNER = {
  chainId: 0,
  partner: null,
  config: null,
};

export const useSpotPartner = (adapterOrPartnerId?: string) => {
  const { data: config } = useSpotConfig();

  
  return useMemo(() => {
    if (!adapterOrPartnerId || !config) return EMPTY_PARTNER;
    const target = adapterOrPartnerId.toLowerCase();    

    for (const [chainId, chainConfig] of Object.entries(config)) {
      if (!chainConfig?.dex) continue;

      for (const [partner, dexConfig] of Object.entries(chainConfig.dex)) {

        
        if (
          typeof dexConfig === "object" &&
          dexConfig.adapter?.toLowerCase() === target || partner.toLowerCase() === target
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
  }, [adapterOrPartnerId, config]);
};
