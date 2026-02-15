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

export type GetOrderChunksContext = {
  srcToken?: Token;
  dstToken?: Token;
  chainId?: number;
};

export type OrderChunksResult = {
  expectedChunks: number | undefined;
  successChunks: ParsedOrderChunk[];
  failedChunks: ParsedOrderChunk[];
  pendingChunks: ParsedOrderChunk[];
  chunks: ParsedOrderChunk[];
};

/**
 * Pure function: computes parsed chunks and grouped lists from order.
 */
export function getOrderChunks(
  order: Order | undefined,
  context: GetOrderChunksContext,
): OrderChunksResult {
  const { srcToken, dstToken, chainId } = context;
  const chunkList = order?.metadata.chunks;
  const srcDecimals = srcToken?.decimals;
  const dstDecimals = dstToken?.decimals;

  const chunks: ParsedOrderChunk[] =
    chunkList
      ?.map((chunk: OrderChunk) => {
        const description = chunk.description?.trim() || undefined;
        return {
          inAmountRaw: chunk.inAmount ?? "0",
          inAmountFormatted: toAmountUI(chunk.inAmount ?? "0", srcDecimals),
          outAmountRaw: chunk.outAmount ?? "0",
          outAmountFormatted: toAmountUI(chunk.outAmount ?? "0", dstDecimals),
          feesUsd: chunk.displayOnlyFee?.replace("$", "") || "0",
          status: chunk.status,
          dueTime: chunk.displayOnlyDueTime,
          createdAt: chunk.timestamp,
          txHash: chunk.txHash ?? "",
          index: chunk.index,
          inToken: chunk.inToken ?? "",
          outToken: chunk.outToken ?? "",
          chainId,
          description,
        };
      })
      .sort((a, b) => a.index - b.index) ?? [];

  return {
    expectedChunks: order?.metadata.expectedChunks,
    successChunks: chunks.filter((c) => c.status === "success"),
    failedChunks: chunks.filter((c) => c.status === "failed"),
    pendingChunks: chunks.filter(
      (c) => c.status !== "success" && c.status !== "failed",
    ),
    chunks,
  };
}

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
    const totalInAmount = order?.order.witness.input.maxAmount || "0";
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
      chunks: getOrderChunks(order, { srcToken, dstToken, chainId }),
      totalInAmount: parseValue(totalInAmount, srcToken?.decimals),
      triggerPrice: parseValue(triggerPrice, dstToken?.decimals),
      limitPrice: parseValue(limitPrice, dstToken?.decimals),
      minOutAmount: parseValue(minOutAmount, dstToken?.decimals),
      dstFilledAmount,
      srcFilledAmount,
      executionRate: parseValue(executionRate, dstToken?.decimals),
      feeUsd,
    };
  }, [isLoading, srcToken, dstToken, chainId, partner, config, order]);
};
