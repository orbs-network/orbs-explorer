import { Token, ParsedOrderChunk, Order, OrderChunk } from "@/lib/types";
import { toAmountUI } from "@/lib/utils/utils";
import { useSpotOrderQuery } from "./use-spot-orders";
import { useToken } from "../use-token";
import { useSpotPartner } from "./use-spot-partner";
import { useMemo } from "react";

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

export function useSpotOrderChunks(hash?: string): { isLoading: boolean, chunks: OrderChunksResult } {
  const { data, isLoading } = useSpotOrderQuery(hash);
  const { chainId } = useSpotPartner(data?.order.witness.exchange.adapter);
  const srcToken = useToken(
    data?.order.witness.input.token,
    chainId,
  ).data;
  const dstToken = useToken(
    data?.order.witness.output.token,
    chainId,
  ).data;
  return useMemo(() => {
    return {
        isLoading,
        chunks: getOrderChunks(data, { srcToken, dstToken, chainId })
    };
  }, [data, srcToken, dstToken, chainId, isLoading]);
}
