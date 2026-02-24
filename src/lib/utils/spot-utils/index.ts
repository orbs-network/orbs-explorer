import { Order, Status, SpotOrderType, Token, ChunkStatus } from "../../types";
import { URL_QUERY_KEYS } from "../../consts";
import { isValidWalletAddress, isNumeric, toAmountUI } from "../utils";
import { isHash, maxUint256 } from "viem";
import moment from "moment";
import BN from "bignumber.js";


export const resolveOrderIdentifier = (identifier: string) => {
  const parsedIdentifiers = identifier.split(",");

  const result: Record<string, string[] | undefined> = {};

  for (const value of parsedIdentifiers) {
    if (isValidWalletAddress(value)) {
      result[URL_QUERY_KEYS.USER] = [
        ...(result[URL_QUERY_KEYS.USER] || []),
        value,
      ];
    }
    if (isHash(value)) {
      result[URL_QUERY_KEYS.HASH] = [
        ...(result[URL_QUERY_KEYS.HASH] || []),
        value,
      ];
    }

  }

  return result;
};

export const millisToDuration = (value?: number) => {
  if (!value) {
    return "";
  }
  const time = moment.duration(value);
  const days = time.days();
  const hours = time.hours();
  const minutes = time.minutes();
  const seconds = time.seconds();

  const arr: string[] = [];

  if (days) {
    arr.push(`${days} days `);
  }
  if (hours) {
    arr.push(`${hours} hours `);
  }
  if (minutes) {
    arr.push(`${minutes} minutes`);
  }
  if (seconds) {
    arr.push(`${seconds} seconds`);
  }
  return arr.join(" ");
};



const getSpotOrderIsTakeProfit = (order?: Order) => {
  return BN(order?.order.witness.output.stop || "0").gte(maxUint256);
};

export const getSpotOrderType = (order?: Order) => {
  const isLimitPrice = BN(order?.order.witness.output.limit || "0").gt(1);
  const isTakeProfit = getSpotOrderIsTakeProfit(order);
  const isStopLoss = BN(order?.order.witness.output.stop || "0").lt(maxUint256) && BN(order?.order.witness.output.stop || "0").gt(0);
  const chunks = order?.metadata.chunks;
  const isTWAP = (chunks?.length || 0) > 1;
  if (isTakeProfit) {
    return SpotOrderType.TAKE_PROFIT;
  }
  if (isLimitPrice) {
    if(isStopLoss) {
      return SpotOrderType.STOP_LOSS_LIMIT;
    }
    if(isTWAP) {
      return SpotOrderType.TWAP_LIMIT;
    }
    return SpotOrderType.LIMIT;
  }

  if(isStopLoss) {
    return SpotOrderType.STOP_LOSS_MARKET;
  }

  return SpotOrderType.TWAP_MARKET;
};


export const getSpotOrderTriggerPricePerChunk = (order?: Order) => {
  if (getSpotOrderIsTakeProfit(order)) {
    return order?.order.witness.output.limit || "0"; 
  }
  return order?.order.witness.output.stop || "0";
};

export const getSpotOrderLimitPrice = (order?: Order) => {
  const isTakeProfit = getSpotOrderIsTakeProfit(order);
  if (isTakeProfit) {
    return '0'
  }
  return order?.order.witness.output.limit || "0";
};

/**
 * Known Solidity errors (from SettlementLib, CosignatureLib, RePermit, Executor, ResolutionLib).
 * Description may contain %s placeholders filled from error params when present.
 */
const KNOWN_CHUNK_ERRORS: { signature: string; name: string; description: string }[] = [
  { signature: "InsufficientPostSwapBalance(uint256,uint256,uint256,uint256)", name: "InsufficientPostSwapBalance", description: "Swap output insufficient: balance=%s, resolved=%s, fees=%s, required=%s" },
  { signature: "InvalidCosignature()", name: "InvalidCosignature", description: "Invalid cosignature" },
  { signature: "InvalidCosignatureInputToken()", name: "InvalidCosignatureInputToken", description: "Cosignature input token mismatch" },
  { signature: "InvalidCosignatureOutputToken()", name: "InvalidCosignatureOutputToken", description: "Cosignature output token mismatch" },
  { signature: "InvalidCosignatureZeroInputValue()", name: "InvalidCosignatureZeroInputValue", description: "Cosignature has zero input value" },
  { signature: "InvalidCosignatureZeroOutputValue()", name: "InvalidCosignatureZeroOutputValue", description: "Cosignature has zero output value" },
  { signature: "InvalidCosignatureReactor()", name: "InvalidCosignatureReactor", description: "Cosignature reactor mismatch" },
  { signature: "InvalidCosignatureChainid()", name: "InvalidCosignatureChainid", description: "Cosignature chain ID mismatch" },
  { signature: "InvalidCosignatureCosigner()", name: "InvalidCosignatureCosigner", description: "Invalid cosigner address" },
  { signature: "StaleCosignature()", name: "StaleCosignature", description: "Cosignature is stale (expired)" },
  { signature: "FutureCosignatureTimestamp()", name: "FutureCosignatureTimestamp", description: "Cosignature timestamp is in the future" },
  { signature: "InvalidFreshness()", name: "InvalidFreshness", description: "Invalid freshness value" },
  { signature: "InvalidFreshnessVsEpoch()", name: "InvalidFreshnessVsEpoch", description: "Freshness exceeds epoch duration" },
  { signature: "InvalidSignature()", name: "InvalidSignature", description: "Invalid signature" },
  { signature: "Expired()", name: "Expired", description: "Order has expired" },
  { signature: "InsufficientAllowance()", name: "InsufficientAllowance", description: "Insufficient token allowance" },
  { signature: "Canceled()", name: "Canceled", description: "Order was canceled" },
  { signature: "InvalidSender()", name: "InvalidSender", description: "Invalid sender address" },
  { signature: "InvalidOrder()", name: "InvalidOrder", description: "Invalid order" },
  { signature: "CosignedExceedsStop()", name: "CosignedExceedsStop", description: "Cosigned amount exceeds stop price" },
];

export type ParsedChunkDescription =
  | { type: "trigger"; current: string; trigger: string; pct: string; symbol: string }
  | { type: "limit_price"; got: string; expected: string; pct: string; symbol: string }
  | { type: "error"; text: string }
  | { type: "text"; text: string };

/**
 * Parses API chunk description into structured data for rendering with Amount components.
 */
export function parseChunkDescription(
  description: string | undefined,
  outputTokenSymbol?: string,
): ParsedChunkDescription {
  if (!description?.trim()) {
    return { type: "text", text: "No details available." };
  }

  const d = description.trim();
  const sym = outputTokenSymbol?.trim() ?? "";

  const triggerMatch = d.match(
    /Trigger price not met,\s*current output\s+([\d.]+)\s*>\s*trigger\s+([\d.]+)\s*-\s*([\d.]+)%/i,
  );
  if (triggerMatch) {
    const [, current, trigger, pct] = triggerMatch;
    return { type: "trigger", current, trigger, pct, symbol: sym };
  }

  const priceMatch = d.match(
    /Price can't meet condition:\s*expected\s+([\d.]+),\s*got\s+([\d.]+)\s*\([^)]+\)\s*-\s*([\d.]+)%/i,
  );
  if (priceMatch) {
    const [, expected, got, pct] = priceMatch;
    return { type: "limit_price", got, expected, pct, symbol: sym };
  }

  for (const err of KNOWN_CHUNK_ERRORS) {
    if (d.includes(err.signature) || d.includes(err.name)) {
      const hasPlaceholders = err.description.includes("%s");
      if (hasPlaceholders) {
        const paramsMatch = d.match(new RegExp(`${escapeRegExp(err.name)}\\s*\\(([^)]+)\\)`));
        const params = paramsMatch
          ? paramsMatch[1].split(",").map((s) => s.trim())
          : [];
        if (params.length > 0) {
          let msg = err.description;
          for (const p of params) {
            msg = msg.replace("%s", p);
          }
          return { type: "error", text: msg.replace(/%s/g, "—") };
        }
      }
      return { type: "error", text: err.description };
    }
  }

  if (/price\s+condition\s+met/i.test(d)) {
    return { type: "text", text: "Price condition was met; execution may still be in progress." };
  }
  if (/slippage/i.test(d)) {
    return {
      type: "text",
      text: "Execution failed due to slippage: the price moved too much before the trade could be filled.",
    };
  }
  if (/insufficient\s+liquidity/i.test(d)) {
    return { type: "text", text: "Not enough liquidity to fill this chunk at the requested price." };
  }
  if (/timeout|expired/i.test(d)) {
    return { type: "text", text: "This chunk did not fill in time and is no longer active." };
  }

  const withoutRawNumbers = d.replace(/\s*\(\d+\s+vs\.\s+\d+\)\s*/g, " ").trim();
  return { type: "text", text: withoutRawNumbers || d };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


export const getOrderFilledAmounts = (order?: Order) => {
  if (!order) return {
    srcFilledAmount: '',
    dstFilledAmount: '',
    feeUsd: '',
  };
  const filledChunks = order.metadata.chunks.filter(
    (chunk) => chunk.status === ChunkStatus.SUCCESS,
  );
  return {
    srcFilledAmount: filledChunks
      .reduce((acc, chunk) => acc.plus(chunk.inAmount || '0'), new BN(0))
      .toFixed(0),
    dstFilledAmount: filledChunks
      .reduce((acc, chunk) => acc.plus(chunk.outAmount || '0'), new BN(0))
      .toFixed(0),
    feeUsd: filledChunks
      .reduce(
        (acc, chunk) => acc.plus(chunk.displayOnlyFee?.replace("$", "") || 0),
        new BN(0),
      )
      .decimalPlaces(2)
      .toString(),
  };
};

export const getOrderExecutionRate = (
  srcFilledAmountFormatted: string,
  dstFilledAmountFormatted: string,
) => {
  if (!BN(srcFilledAmountFormatted || 0).gt(0) || !BN(dstFilledAmountFormatted || 0).gt(0))
    return "";
  return BN(dstFilledAmountFormatted).div(srcFilledAmountFormatted).toFixed()
};



export const getMinAmountPerChunk = (order?: Order) => {
  const isTakeProfit = getSpotOrderIsTakeProfit(order);
  if (isTakeProfit) {
    return "0";
  }
  return order?.order.witness.output.limit || "0";
};

export const parseOrderType = (type: SpotOrderType) => {
  if (type === SpotOrderType.TAKE_PROFIT) return "Take Profit";
  if (type === SpotOrderType.LIMIT) return "Limit";
  if (type === SpotOrderType.STOP_LOSS_LIMIT) return "Stop Loss (Limit)";
  if (type === SpotOrderType.TWAP_LIMIT) return "TWAP (Limit)";
  if (type === SpotOrderType.STOP_LOSS_MARKET) return "Stop Loss (Market)";
  if (type === SpotOrderType.TWAP_MARKET) return "TWAP (Market)";
  return type;
};

export const getOrderLimitPriceRate = (
  chunkAmountFormatted: string,
  minOutAmountFormatted: string,
) => {
  if (!BN(chunkAmountFormatted || 0).gt(0) || !BN(minOutAmountFormatted || 0).gt(0))
    return "";
  return BN(minOutAmountFormatted).div(chunkAmountFormatted).toString();
};



export const getOrderTriggerPriceRate = (
  chunkAmountFormatted: string,
  triggerPriceFormatted: string,
) => {
  if (BN(chunkAmountFormatted || 0).lte(0) || BN(triggerPriceFormatted || 0).lte(0))
    return "";
  return BN(triggerPriceFormatted).div(chunkAmountFormatted).toString();
};

export const getOrderStatus = (order?: Order): Status => {
  if (!order) return Status.PENDING;
  if (order.metadata.description?.toLowerCase().includes("cancelled"))
    return Status.CANCELLED;
  const s = order.metadata.status ?? "";
  if (s.includes("failed")) return Status.FAILED;
  if (s === Status.COMPLETED) return Status.COMPLETED;
  if (s === Status.PARTIALLY_COMPLETED) return Status.PARTIALLY_COMPLETED;
  if (s.includes("completed")) return Status.COMPLETED;
  return Status.PENDING;
};