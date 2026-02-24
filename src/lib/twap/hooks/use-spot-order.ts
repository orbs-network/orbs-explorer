import {
  getSpotOrderTriggerPricePerChunk,
  getSpotOrderLimitPrice,
  getSpotOrderType,
  getOrderExecutionRate,
  getOrderFilledAmounts,
  getMinAmountPerChunk,
  getOrderLimitPriceRate,
  getOrderTriggerPriceRate,
  getOrderStatus,
} from "../utils";
import { toAmountUI, toMoment } from "../../utils/utils";
import moment from "moment";
import { useMemo } from "react";
import BN from "bignumber.js";
import { useSpotPartner } from "./use-spot-partner";
import { useSpotOrderQuery } from "./use-spot-orders";
import { useToken } from "../../hooks/use-token";

const parseValue = (value: string | undefined, decimals?: number) => {
  return {
    raw: value,
    formatted: toAmountUI(value, decimals) || "0",
  };
};

export function useSpotOrder(hash?: string) {
  const { data: order, isLoading } = useSpotOrderQuery(hash);
  const { chainId, partner, config } = useSpotPartner(
    order?.order.witness.exchange.adapter
  );
  const srcToken = useToken(order?.order.witness.input.token, chainId).data;
  const dstToken = useToken(order?.order.witness.output.token, chainId).data;

  return useMemo(() => {
    const expectedAmountOutPerChunk = parseValue(
      getSpotOrderTriggerPricePerChunk(order),
      dstToken?.decimals
    );
    const limitPrice = getSpotOrderLimitPrice(order);

    const {
      srcFilledAmount: srcFilledAmountRaw,
      dstFilledAmount: dstFilledAmountRaw,
      feeUsd,
    } = getOrderFilledAmounts(order);
    const chunkAmount = parseValue(
      order?.order.witness.input.amount,
      srcToken?.decimals
    );
    const minOutAmountPerChunk = parseValue(
      getMinAmountPerChunk(order),
      dstToken?.decimals
    );
    const srcFilledAmount = parseValue(
      srcFilledAmountRaw,
      srcToken?.decimals
    );
    const dstFilledAmount = parseValue(
      dstFilledAmountRaw,
      dstToken?.decimals
    );
    const executionRate = getOrderExecutionRate(
      srcFilledAmount.formatted,
      dstFilledAmount.formatted
    );
    const triggerPriceRate = getOrderTriggerPriceRate(
      chunkAmount.formatted,
      expectedAmountOutPerChunk.formatted
    );
    const limitPriceRate = getOrderLimitPriceRate(
      chunkAmount.formatted,
      minOutAmountPerChunk.formatted
    );
    const deadline = BN(order?.order.witness.deadline || 0)
      .multipliedBy(1000)
      .toFixed();

    const totalMinOutAmount = parseValue(
      BN(minOutAmountPerChunk.raw || 0)
        .multipliedBy(order?.metadata.expectedChunks || 1)
        .toFixed(),
      dstToken?.decimals
    );
    const totalExpectedAmountOut = parseValue(
      BN(expectedAmountOutPerChunk.raw || 0)
        .multipliedBy(order?.metadata.expectedChunks || 1)
        .toFixed(),
      dstToken?.decimals
    );

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
      createdAt: toMoment(order?.timestamp),
      expiration: moment(Number(deadline)),
      epoch: order?.order.witness.epoch || 0,
      totalInAmount: parseValue(
        order?.order.witness.input.maxAmount || "0",
        srcToken?.decimals
      ),
      expectedAmountOutPerChunk,
      totalExpectedAmountOut,
      limitPrice: parseValue(limitPrice, dstToken?.decimals),
      minOutAmountPerChunk,
      totalMinOutAmount,
      dstFilledAmount,
      srcFilledAmount,
      executionRate,
      limitPriceRate,
      triggerPriceRate,
      chunkAmount,
      feeUsd,
      totalChunks: order?.metadata.expectedChunks || 0,
      status: getOrderStatus(order),
    };
  }, [isLoading, srcToken, dstToken, chainId, partner, config, order]);
}
