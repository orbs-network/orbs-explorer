import { useMemo } from "react";
import { useSpotConfig } from "./use-spot-config";
import type { ListOrder } from "../types";
import { getSpotPartnerConfig, getTwapOrderChainId } from "../utils";

export function useSpotPartner(
  adapterOrPartnerId?: string,
  partnerChainId?: number,
) {
  const { data: config } = useSpotConfig();

  return useMemo(
    () =>
      getSpotPartnerConfig(
        config ?? {},
        adapterOrPartnerId ?? "",
        partnerChainId ?? 0,
      ),
    [adapterOrPartnerId, config, partnerChainId],
  );
}

export function useSpotPartnerListOrder(order?: ListOrder) {
  return useSpotPartner(order?.exchangeAdapter, getTwapOrderChainId(order));
}
