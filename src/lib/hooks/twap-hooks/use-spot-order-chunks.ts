import { Token, ParsedOrderChunk, Order, OrderChunk, Status, ChunkStatus } from "@/lib/types";
import { toAmountUI } from "@/lib/utils/utils";
import { useMemo } from "react";
import { useSpotOrder } from "./use-spot-order";

export type GetOrderChunksContext = {
  srcToken?: Token;
  dstToken?: Token;
  chainId?: number;
  status?: Status;
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
  const { srcToken, dstToken, chainId, status: orderStatus } = context;
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
          status: orderStatus === Status.CANCELLED ?  'cancelled' : chunk.status,
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
    successChunks: chunks.filter((c) => c.status === ChunkStatus.SUCCESS),
    failedChunks: chunks.filter((c) => c.status === ChunkStatus.FAILED),
    pendingChunks: chunks.filter(
      (c) => c.status !== ChunkStatus.SUCCESS && c.status !== ChunkStatus.FAILED,
    ),
    chunks,
  };
}

export function useSpotOrderChunks(hash?: string): {
  isLoading: boolean;
  chunks: OrderChunksResult;
} {
  const { originalOrder, isLoading, srcToken, dstToken, chainId, status } =
    useSpotOrder(hash);

  return useMemo(() => {
    return {
      isLoading,
      chunks: getOrderChunks(originalOrder, { srcToken, dstToken, chainId, status }),
    };
  }, [originalOrder, srcToken, dstToken, chainId, isLoading, status]);
}
