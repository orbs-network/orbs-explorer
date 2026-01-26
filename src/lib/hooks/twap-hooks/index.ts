import { useCallback, useMemo } from "react";
import { Partners, Order, ParsedOrderChunk } from "../../types";
import { useToken } from "../use-token";
import {
  getOrderExecutionRate,
  getOrderFilledAmounts,
  getOrderLimitPriceRate,
  toAmountUI,
} from "../../utils/utils";
import { useToUiAmount } from "../use-to-ui-amount";
import { useToWeiAmount } from "../use-to-wei-amount";
import { useSpotOrderQuery } from "../use-spot-orders";
import { PARTNERS } from "../../partners";
import { useSpotConfig } from "../use-twap-config";

const getPartner = (_partner: string) => {
  let partner = _partner;
  if (partner === "spooky") {
    partner = Partners.Spookyswap;
  }

  return PARTNERS.find((item) => item.id.toLowerCase() === partner);
};

const EMPTY_PARTNER = {
  chainId: 0,
  partner: null,
  config: null,
};

export const useTwapPartnerByAdapter = (adapter?: string) => {
  const { data: config } = useSpotConfig();
  return useMemo(() => {
    if (!adapter || !config) return EMPTY_PARTNER;
    const target = adapter.toLowerCase();

    for (const [chainId, chainConfig] of Object.entries(config)) {
      if (!chainConfig?.dex) continue;

      for (const [partner, dexConfig] of Object.entries(chainConfig.dex)) {
        if (
          typeof dexConfig === "object" &&
          dexConfig.adapter?.toLowerCase() === target
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
  }, [adapter, config]);
};


export const useTwapPartnerById = (partnerId?: string) => {
  const { data: config } = useSpotConfig();
  return useMemo(() => {
    if (!partnerId || !config) return EMPTY_PARTNER;
    const target = partnerId.toLowerCase();

    for (const [chainId, chainConfig] of Object.entries(config)) {
      if (!chainConfig?.dex) continue;

      for (const [partner, dexConfig] of Object.entries(chainConfig.dex)) {
        if (
          typeof dexConfig === "object" &&
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
  }, [partnerId, config]);
};

export const useOrderFilledAmounts = (order?: Order) => {
  const dex = useTwapPartnerByAdapter(order?.order.witness.exchange.adapter);
  const srcToken = useToken(
    order?.order.witness.input.token,
    dex?.chainId,
  ).data;
  const dstToken = useToken(
    order?.order.witness.output.token,
    dex?.chainId,
  ).data;
  const { dstFilledAmount, srcFilledAmount, feeUsd } = useMemo(() => {
    return getOrderFilledAmounts(order);
  }, [order]);
  return {
    srcFilledAmountFormatted: useToUiAmount(
      srcToken?.decimals,
      srcFilledAmount,
    ),
    dstFilledAmountFormatted: useToUiAmount(
      dstToken?.decimals,
      dstFilledAmount,
    ),
    srcFilledAmountRaw: srcFilledAmount,
    dstFilledAmountRaw: dstFilledAmount,
    feeUsd,
  };
};

export const useOrderExecutionRate = (order?: Order) => {
  const dex = useTwapPartnerByAdapter(order?.order.witness.exchange.adapter);
  const srcToken = useToken(
    order?.order.witness.input.token,
    dex?.chainId,
  ).data;
  const dstToken = useToken(
    order?.order.witness.output.token,
    dex?.chainId,
  ).data;
  const formatted = useMemo(() => {
    if (!order || !srcToken || !dstToken) return;
    return getOrderExecutionRate(order, srcToken, dstToken);
  }, [order, srcToken, dstToken]);
  return {
    raw: useToWeiAmount(dstToken?.decimals, formatted),
    formatted,
  };
};

export const useOrderLimitPriceRate = (order?: Order) => {
  const dex = useTwapPartnerByAdapter(order?.order.witness.exchange.adapter);
  const srcToken = useToken(
    order?.order.witness.input.token,
    dex?.chainId,
  ).data;
  const dstToken = useToken(
    order?.order.witness.output.token,
    dex?.chainId,
  ).data;
  const formatted = useMemo(() => {
    if (!order || !srcToken || !dstToken) return;
    return getOrderLimitPriceRate(order, srcToken, dstToken);
  }, [order, srcToken, dstToken]);
  return {
    raw: useToWeiAmount(dstToken?.decimals, formatted),
    formatted,
  };
};

export const useOrder = (hash?: string) => {
  const { data: order, isLoading } = useSpotOrderQuery(hash);
  const { partner, chainId, config } = useTwapPartnerByAdapter(
    order?.order.witness.exchange.adapter,
  );
  const srcToken = useToken(order?.order.witness.input.token, chainId).data;
  const dstToken = useToken(order?.order.witness.output.token, chainId).data;

  return useMemo(() => {
    return {
      order,
      isLoading,
      srcToken,
      dstToken,
      partner,
      chainId,
      config,
    };
  }, [order, isLoading, srcToken, dstToken, partner, chainId, config]);
};

export const useOrderChunks = (hash?: string) => {
  const { order, srcToken, dstToken, chainId } = useOrder(hash);
  const chunks =  useMemo((): ParsedOrderChunk[] => {
    const chunks = order?.metadata.chunks;

    return chunks
      ?.map((chunk) => {
        return {
          inAmountRaw: chunk.inAmount,
          inAmountFormatted: toAmountUI(chunk.inAmount, srcToken?.decimals),
          outAmountRaw: chunk.outAmount,
          outAmountFormatted: toAmountUI(chunk.outAmount, dstToken?.decimals),
          feesUsd: chunk.displayOnlyFee?.replace("$", "") || "0",
          status: chunk.status,
          dueTime: chunk.displayOnlyDueTime,
          createdAt: chunk.timestamp,
          txHash: chunk.txHash,
          index: chunk.index,
          inToken: chunk.inToken,
          outToken: chunk.outToken,
          chainId: chainId,

        };
      })
      .sort((a, b) => a.index - b.index) ?? [];
  }, [order, srcToken, dstToken, chainId]);

  return {
    expectedChunks: order?.metadata.expectedChunks,
    successChunks: chunks.filter((chunk) => chunk.status === "success"),
    failedChunks: chunks.filter((chunk) => chunk.status === "failed"),
  };
};
