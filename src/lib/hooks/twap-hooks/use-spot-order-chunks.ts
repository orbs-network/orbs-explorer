import {
  Token,
  ParsedOrderChunk,
  Order,
  OrderChunk,
  Status,
  ChunkStatus,
} from "@/lib/types";
import { useMemo } from "react";
import { useSpotOrder } from "./use-spot-order";
import BN from "bignumber.js";
import { toAmountUI } from "@/lib/utils/utils";

/**
 * Computes expected output amount in out-token raw units from input amount and exchange rate.
 * Uses src token decimals for input and dst token decimals for output.
 */
function computeExpectedOutputInOutTokenDecimals(
  inAmountRaw: string,
  exchangeRate: string,
  srcDecimals: number,
  dstDecimals: number,
): string {
  const inAmountUi = BN(inAmountRaw).dividedBy(BN(10).pow(srcDecimals));
  const expectedOutUi = inAmountUi.multipliedBy(exchangeRate);
  return expectedOutUi
    .multipliedBy(BN(10).pow(dstDecimals))
    .decimalPlaces(0)
    .toFixed();
}

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
export function parseOrderChunks(
  order: Order | undefined,
  context: GetOrderChunksContext,
): OrderChunksResult {
  const { srcToken, dstToken, chainId, status: orderStatus } = context;
  const chunkList = order?.metadata.chunks;

  const chunks: ParsedOrderChunk[] =
    chunkList
      ?.map((chunk: OrderChunk) => {
        const oracle = chunk.oraclePricingData?.[0];
        const description = chunk.description?.trim() || undefined;
        const inputTokenUsd = BN(oracle?.message.input.value.toString() ?? "0")
          .dividedBy(1e18)
          .toFixed();
        const outputTokenUsd = BN(
          oracle?.message.output.value.toString() ?? "0",
        )
          .dividedBy(1e18)
          .toFixed();
        const exchangeRate = BN(inputTokenUsd)
          .div(BN(outputTokenUsd))
          .toFixed();
        const inAmount = chunk.inAmount ?? "0";
        
        const outAmount = chunk.outAmount ?? "0";
        const solverOutAmount = chunk.solverReportedOutput?.outputAmount ?? "0";
        const expectedOutputOracle = computeExpectedOutputInOutTokenDecimals(
          inAmount,
          exchangeRate,
          srcToken?.decimals ?? 0,
          dstToken?.decimals ?? 0,
        );
        const outAmountDiff = BN(expectedOutputOracle).isZero()
          ? "0"
          : BN(solverOutAmount)
              .minus(BN(expectedOutputOracle))
              .div(BN(expectedOutputOracle))
              .multipliedBy(100)
              .toFixed();
        const feeOnTransfer = chunk.transferFeeEstimation?.inputTokenFee ?? "0";

        return {
          inAmount,
          outAmount: chunk.outAmount ?? "0",
          feesUsd: chunk.displayOnlyFee?.replace("$", "") || "0",
          status:
            orderStatus === Status.CANCELLED
              ? "cancelled"
              : orderStatus === Status.FAILED
                ? "failed"
                : chunk.status,
          dueTime: chunk.displayOnlyDueTime,
          updatedAt: chunk.timestamp,
          createdAt: chunk.createdAt,
          txHash: chunk.txHash ?? "",
          index: chunk.index,
          inToken: srcToken,
          outToken: dstToken,
          chainId,
          description,
          blockId: chunk.blockId,
          displayOnlyFee: chunk.displayOnlyFee,
          epoch: chunk.epoch,
          executor: chunk.executor,
          extraTitle: chunk.extraTitle,
          minOut: chunk.minOut,
          settled: chunk.settled,
          exchange: chunk.exchange,
          swapper: chunk.swapper,
          oracleName: oracle?.oracleName,
          oracleAddress: oracle?.oracle,
          oracleTimestamp: oracle?.timestamp,
          inputTokenUsd,
          outputTokenUsd,
          solverOutAmount,
          solverName: chunk.solverReportedOutput?.solverName ?? "",
          minAmountOut: chunk.minOut ?? "0",
          exchangeRate,
          expectedOutputOracle,
          outAmountDiff,
          inputTotalUsd: BN(toAmountUI(inAmount, srcToken?.decimals ?? 0))
            .multipliedBy(inputTokenUsd)
            .toFixed(),
          outputTotalUsd: BN(toAmountUI(outAmount, dstToken?.decimals ?? 0))
            .multipliedBy(outputTokenUsd)
            .toFixed(),
          feeOnTransfer,
          feeOnTransferError: chunk.transferFeeEstimation?.error ?? "",
        };
      })
      .sort((a, b) => a.index - b.index) ?? [];

  return {
    expectedChunks: order?.metadata.expectedChunks,
    successChunks: chunks.filter((c) => c.status === ChunkStatus.SUCCESS),
    failedChunks: chunks.filter(
      (c) => c.status === ChunkStatus.FAILED || c.status === Status.CANCELLED,
    ),
    pendingChunks: chunks.filter(
      (c) =>
        c.status !== ChunkStatus.SUCCESS &&
        c.status !== ChunkStatus.FAILED &&
        c.status !== Status.CANCELLED,
    ),
    chunks,
  };
}

export function useSpotOrderChunks(hash?: string): {
  order: ReturnType<typeof useSpotOrder>;
  chunks: OrderChunksResult;
} {
  const order = useSpotOrder(hash);

  return useMemo(() => {
    return {
      order,
      chunks: parseOrderChunks(order?.originalOrder, {
        srcToken: order?.srcToken,
        dstToken: order?.dstToken,
        chainId: order?.chainId,
        status: order?.status,
      }),
    };
  }, [order]);
}
