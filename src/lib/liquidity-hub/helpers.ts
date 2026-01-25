/* eslint-disable @typescript-eslint/no-explicit-any */
import { LiquidityHubQuote, LiquidityHubSwap } from "./types";
import BN from "bignumber.js";
import {
  decodeEventLog,
  erc20Abi,
  keccak256,
  toBytes,
  TransactionReceipt,
} from "viem";
import { TransferLog } from "./types";
import { LIQUIDITY_HUB_PARTNER_CHAINS } from "./partner-chains";
import { Partners } from "../types";



export function padArrayToLength<T = number>(arr: T[], targetLength: number, padValue: T = 0 as T): T[] {
  const paddingCount = Math.max(0, targetLength - arr.length);
  const padding = Array<T>(paddingCount).fill(padValue);
  return [...padding, ...arr];
}



const addSlippage = (amount?: string | number, slippage?: number) => {
  if (!amount || !slippage) return "";

  const slippageBN = BN(amount).times(slippage).div(100);

  return BN(amount).plus(slippageBN).toString();
};



const getGasCostOutToken = (quote: LiquidityHubQuote) => {
  const gasCost = (quote as any)["auctionData.gasCost"];
  const exchange = (quote as any)["auctionData.exchange"];

  const length = exchange?.length || 0;
  const winnerIndex = exchange?.indexOf(quote.auctionWinner) || 0;
  const padding = padArrayToLength(gasCost || [], length, 0);
  return padding[winnerIndex] || "";
};

export const getExpectedLhAmountOut = (
  swap?: LiquidityHubSwap,
  quote?: LiquidityHubQuote,
) => {
  if (!swap || !quote) return "0";

  const lhAmountOutWS = addSlippage(swap.amountOut, swap.slippage) || 0;

  const gasCostOutToken = getGasCostOutToken(quote);
  const result = BN(lhAmountOutWS)
    .minus(gasCostOutToken)
    .decimalPlaces(0)
    .toFixed();
  return result;
};

export const getDexAmountOutWSminusGas = (
  swap?: LiquidityHubSwap,
  quote?: LiquidityHubQuote,
) => {
  if (!swap || !quote) return "";
  const dexAmountOutWS = addSlippage(swap.amountOutUI, swap.slippage) || "";
  const gasCostOutToken = getGasCostOutToken(quote);
  return BN(dexAmountOutWS).gt(0)
    ? BN(dexAmountOutWS).minus(gasCostOutToken).toFixed()
    : "";
};

export const getLhExactOutAmountPreDeduction = (
  swap?: LiquidityHubSwap,
  quote?: LiquidityHubQuote,
) => {
  if (!swap || !quote) return "";
  const gasCostOutToken = getGasCostOutToken(quote);
  return BN(swap.exactOutAmount || 0)
    .plus(gasCostOutToken || 0)
    .plus(swap.feeOutAmount || 0)
    .toFixed();
};

export const getAmountReceivedPostDeductions = (swap?: LiquidityHubSwap) => {
  if (!swap) return "";
  return BN(swap.exactOutAmount || 0)
    .plus(swap.exactOutAmountSavings || 0)
    .toFixed();
};

export const getUserSavings = (
  swap?: LiquidityHubSwap,
  quote?: LiquidityHubQuote,
) => {
  if (!swap || !quote) return "0";
  const dexAmountOutWSminusGas = getDexAmountOutWSminusGas(swap, quote);
  const userSavings = BN(dexAmountOutWSminusGas).gt(0)
    ? BN(swap.exactOutAmount || 0).minus(dexAmountOutWSminusGas || 0)
    : BN(0);

  return userSavings.toFixed();
};

const ERC20_TRANSFER_EVENT_TOPIC = keccak256(
  toBytes("Transfer(address,address,uint256)"),
);

export const getERC20Transfers = async (
  receipt: TransactionReceipt,
): Promise<TransferLog[]> => {
  const transferLogs = receipt.logs.filter(
    (log) => log.topics[0]?.toLowerCase() === ERC20_TRANSFER_EVENT_TOPIC,
  );

  const transfersP = transferLogs.map(async (log) => {
    try {
      const parsedLog = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
        eventName: "Transfer",
      });

      return {
        parsedLog,
        tokenAddress: log.address,
      };
    } catch {
      return undefined;
    }
  });

  const transfers = (await Promise.all(transfersP)).filter(Boolean);

  return transfers.filter(Boolean).map((transfer) => {
    const { args } = transfer!.parsedLog;

    return {
      from: args.from,
      to: args.to,
      value: args.value.toString(),
      tokenAddress: transfer!.tokenAddress,
    };
  });
};

export const getPartnerChains = (partnerId?: Partners) => {
  if (!partnerId) return [];
  return LIQUIDITY_HUB_PARTNER_CHAINS[
    partnerId as keyof typeof LIQUIDITY_HUB_PARTNER_CHAINS
  ];
};


export const keywordScriptFilter = (field: string, values: string[]) => ({
  script: {
    script: {
      source: `params.values.contains(doc['${field}'].value.toLowerCase())`,
      params: {
        values: values.map((v) => v.toLowerCase()),
      },
    },
  },
});
