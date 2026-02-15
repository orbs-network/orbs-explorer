import {
  getSpotOrderTriggerPrice,
  getSpotOrderLimitPrice,
  getSpotOrderType,
  getOrderExecutionRate,
  getOrderFilledAmounts,
} from "@/lib/utils/spot-utils";
import {
  toMoment,
  toAmountUI,
} from "@/lib/utils/utils";
import moment from "moment";
import { useMemo } from "react";
import BN from "bignumber.js";
import { useSpotPartner } from "./use-spot-partner";
import { useSpotOrderQuery } from "./use-spot-orders";
import { useToken } from "../use-token";
import { Order, OrderChunk, ParsedOrderChunk, Token } from "@/lib/types";


const parseValue = (value: string | undefined, decimals?: number) => {
  return {
    raw: value,
    formatted: toAmountUI(value, decimals),
  };
};

export const useSpotOrder = (hash?: string) => {
  const { data: order, isLoading } = useSpotOrderQuery(hash);
  const { chainId, partner, config } = useSpotPartner(
    order?.order.witness.exchange.adapter,
  );
  const srcToken = useToken(order?.order.witness.input.token, chainId).data;
  const dstToken = useToken(order?.order.witness.output.token, chainId).data;

  return useMemo(() => {
    const triggerPrice = getSpotOrderTriggerPrice(order);
    const limitPrice = getSpotOrderLimitPrice(order);
 
    const { srcFilledAmount: srcFilledAmountRaw, dstFilledAmount: dstFilledAmountRaw, feeUsd } =
      getOrderFilledAmounts(order);


      const srcFilledAmount = parseValue(srcFilledAmountRaw, srcToken?.decimals);
      const dstFilledAmount = parseValue(dstFilledAmountRaw, dstToken?.decimals);
      const executionRate =
      getOrderExecutionRate(srcFilledAmount.formatted, dstFilledAmount.formatted);

    const deadline = BN(order?.order.witness.deadline || 0)
      .multipliedBy(1000)
      .toFixed();
    const minOutAmount = order?.order.witness.output.limit || "0";

    return {
      originalOrder: order,
      hash: order?.hash,
      swapper: order?.order.witness.swapper,
      isLoading,
      srcToken,
      dstToken,
      partner,
      chainId,
      config,
      type: getSpotOrderType(order),
      description: order?.metadata.description,
      status: order?.metadata.status.toLowerCase(),
      createdAt: toMoment(order?.timestamp),
      expiration: moment(Number(deadline)),
      epoch: order?.order.witness.epoch || 0,
      totalInAmount: parseValue(order?.order.witness.input.maxAmount || "0", srcToken?.decimals),
      triggerPrice: parseValue(triggerPrice, dstToken?.decimals),
      limitPrice: parseValue(limitPrice, dstToken?.decimals),
      minOutAmount: parseValue(minOutAmount, dstToken?.decimals),
      dstFilledAmount,
      srcFilledAmount,
      executionRate: parseValue(executionRate, dstToken?.decimals),
      chunkAmount: parseValue(order?.order.witness.input.amount, srcToken?.decimals),
      feeUsd,
      totalChunks: order?.metadata.expectedChunks || 0,
    };
  }, [isLoading, srcToken, dstToken, chainId, partner, config, order]);
};
