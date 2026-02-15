import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import moment from "moment";
import { FILTER_KEY_NAMES, ROUTES, URL_QUERY_KEYS } from "../consts";
import { useQueryFilterParams } from "../hooks/use-query-filter-params";
import { map } from "lodash";
import { formatUnits, parseUnits, zeroAddress } from "viem";
import BN from "bignumber.js";
import { ListOrder, Order, Token } from "../types";
import { PARTNERS } from "../partners";
import * as chains from "viem/chains";
import { chainLogosByChainId, wTokensByChainId } from "../chain";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function isNumeric(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

export const isValidWalletAddress = (address: string) => {
  const ethereumAddressPattern = /^0x[a-fA-F0-9]{40}$/;

  return ethereumAddressPattern.test(address);
};

export const parseTimestampFromQuery = (timestamp?: string) => {
  if (!timestamp) return { from: undefined, to: undefined };

  const [from, to] = timestamp.split("-");
  return {
    from: from ? moment(Number(from)).valueOf() : undefined,
    to: to ? moment(Number(to)).valueOf() : moment().valueOf(),
  };
};

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export const parseAppliedFilters = (
  query: ReturnType<typeof useQueryFilterParams>["query"],
) => {
  return map(query, (value, key) => {
    const name = FILTER_KEY_NAMES[key as keyof typeof FILTER_KEY_NAMES];

    if (key === URL_QUERY_KEYS.TIMESTAMP && value) {
      const { from, to } = parseTimestampFromQuery(value as string);
      return {
        key,
        value: `${moment(from).format("DD/MM/YYYY")} - ${moment(to).format(
          "DD/MM/YYYY",
        )}`,
        name,
      };
    }
    return {
      key,
      value,
      name,
    };
  });
};

export function formatDecimals(
  value?: string,
  scale = 6,
  maxDecimals = 8,
): string {
  if (!value) return "";

  // ─── keep the sign, work with the absolute value ────────────────
  const sign = value.startsWith("-") ? "-" : "";
  const abs = sign ? value.slice(1) : value;

  const [intPart, rawDec = ""] = abs.split(".");

  // Fast-path: decimal part is all zeros (or absent) ───────────────
  if (!rawDec || Number(rawDec) === 0) return sign + intPart;

  /** Case 1 – |value| ≥ 1 *****************************************/
  if (intPart !== "0") {
    const sliced = rawDec.slice(0, scale);
    const cleaned = sliced.replace(/0+$/, ""); // drop trailing zeros
    const trimmed = cleaned ? "." + cleaned : "";
    return sign + intPart + trimmed;
  }

  /** Case 2 – |value| < 1 *****************************************/
  const firstSigIdx = rawDec.search(/[^0]/); // first non-zero position
  if (firstSigIdx === -1) return "0"; // decimal part is all zeros
  if (firstSigIdx + 1 > maxDecimals) return "0"; // too many leading zeros → 0

  const leadingZeros = rawDec.slice(0, firstSigIdx); // keep them
  const significantRaw = rawDec.slice(firstSigIdx).slice(0, scale);
  const significant = significantRaw.replace(/0+$/, ""); // trim trailing zeros

  return significant ? sign + "0." + leadingZeros + significant : "0";
}

export const abbreviate = (num: string | number, maxDecimals = 2) => {
  if (!num || num === "0" || isNaN(Number(num))) return "0";
  if (typeof num === "number") {
    num = num.toString();
  }
  const abs = Number(num);
  if (abs >= 1e9) return (abs / 1e9).toFixed(2).replace(/\.0+$/, "") + "B";
  if (abs >= 1e6) return (abs / 1e6).toFixed(2).replace(/\.0+$/, "") + "M";
  if (abs >= 1e3) return (abs / 1e3).toFixed(2).replace(/\.0+$/, "") + "K";

  return String(formatDecimals(num, maxDecimals));
};

export const toAmountUI = (amount?: string | number, decimals?: number) => {
  if (!decimals || !amount) return "";
  try {
    return formatUnits(BigInt(amount), decimals);
  } catch (error) {
    return "0";
  }
};

export const toAmountWei = (amount?: string, decimals?: number) => {
  if (!decimals || !amount) return "0";

  try {
    return parseUnits(amount, decimals).toString();
  } catch (error) {
    return "0";
  }
};

export const getChain = (chainId?: number) => {
  if (!chainId) return undefined;
  return Object.values(chains).find((chain) => chain.id === chainId);
};

export const getOrderProgress = (order: Order) => {
  const totalChunks = order.metadata.expectedChunks;
  const filledChunks = order.metadata.chunks.filter(
    (chunk) => chunk.status === "success",
  ).length;
  return BN((filledChunks / totalChunks) * 100)
    .decimalPlaces(2)
    .toNumber();
};

export const getOrderFilledAmounts = (order?: Order) => {
  if (!order) return {
    srcFilledAmount: '',
    dstFilledAmount: '',
    feeUsd: '',
  };
  const filledChunks = order.metadata.chunks.filter(
    (chunk) => chunk.status === "success",
  );
  return {
    srcFilledAmount: filledChunks
      .reduce((acc, chunk) => acc.plus(chunk.inAmount), new BN(0))
      .toFixed(0),
    dstFilledAmount: filledChunks
      .reduce((acc, chunk) => acc.plus(chunk.outAmount), new BN(0))
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
  order: Order,
  srcToken: Token,
  dstToken: Token,
) => {
  const { srcFilledAmount, dstFilledAmount } = getOrderFilledAmounts(order);

  if (!BN(srcFilledAmount || 0).gt(0) || !BN(dstFilledAmount || 0).gt(0))
    return "";
  const srcFilledAmountUi = toAmountUI(srcFilledAmount, srcToken.decimals);
  const dstFilledAmountUi = toAmountUI(dstFilledAmount, dstToken.decimals);

  return BN(dstFilledAmountUi).div(srcFilledAmountUi).toFixed()
};

export const getOrderLimitPriceRate = (
  order: Order,
  srcToken: Token,
  dstToken: Token,
) => {
  const limit = order.order.witness.output.limit 
  if (BN(limit || 0).isZero()) return "";
  const srcBidAmountUi = toAmountUI(order.order.witness.input.amount, srcToken.decimals, );
  const dstMinAmountUi = toAmountUI(limit, dstToken.decimals);
  return BN(dstMinAmountUi).div(srcBidAmountUi).toFixed();
};


export const toMoment = (timestamp?: string) => {
  if (!timestamp) return moment();
  const normalized = timestamp.replace(
    /\.(\d{3})\d+Z$/,
    '.$1Z'
  );
  return moment(normalized);
};

export function formatDuration(seconds: number): string {
  console.log({seconds});
  
  const format = (value: number, unit: string) => {
    const v = Number.isInteger(value) ? value : value.toFixed(1);
    return `${v}${unit}`;
  };

  if (seconds < 60) {
    return format(seconds, 's');
  }

  const minutes = seconds / 60;
  if (minutes < 60) {
    return format(minutes, 'm');
  }

  const hours = minutes / 60;
  if (hours < 24) {
    return format(hours, 'h');
  }

  const days = hours / 24;
  return format(days, 'd');
}


export const getPartnersById = (ids?: string[]) => {
  if (!ids) return undefined;
  
  return PARTNERS.filter((p) => ids.some(id => p.identifiers.some(i => i.toLowerCase() === id.toLowerCase())));
};

export const getWrappedNativeCurrency = (chainId?: number) => {
  if (!chainId) return undefined;

 return wTokensByChainId[chainId as keyof typeof wTokensByChainId];
};


export const parseListOrderStatus = (order: ListOrder) => {
  const totalChunks = order.metadata.chunkSummary.total;
  const successChunks = order.metadata.chunkSummary.success;
  const deadline = Number(order.order.witness.deadline) * 1000;

  if (successChunks === totalChunks) return "completed";
  if (deadline < Date.now()) return "expired";
  if (order.metadata.status.includes('canceled')) return "canceled";

  return "open";

};

export const parseOrderStatus = (order: Order) => {
  const totalChunks = order.metadata.expectedChunks;
  const successChunks = order.metadata.chunks.filter(
    (chunk) => chunk.status === "success",
  ).length;
  const deadline = Number(order.order.witness.deadline) * 1000;

  if (successChunks === totalChunks) return "completed";
  if (deadline < Date.now()) return "expired";
  if (order.metadata.status.includes('canceled')) return "canceled";

  return "open";

};


export const eqIgnoreCase = (a: string, b: string) => {
  return a.toLowerCase() === b.toLowerCase();
};

export const isNativeAddress = (address: string) => {
  return eqIgnoreCase(address, zeroAddress);
};

export const getChainLogo = (chainId?: number) => {
  if (!chainId) return undefined;
  return chainLogosByChainId[chainId as keyof typeof chainLogosByChainId];
};

const SUPPORTED_CHAINS = [
  chains.mainnet.id,
  chains.bsc.id,
  chains.polygon.id,
  chains.base.id,
  chains.fantom.id,
  chains.avalanche.id,
  chains.arbitrum.id,
  chains.berachain.id,
  chains.flare.id,
  chains.sonic.id,
  chains.cronoszkEVM.id,
  chains.katana.id,
  chains.sei.id,
  chains.monad.id,
] as number[];

export const getChains = () => {
  const chainsData = Object.values(chains).map((chain) => ({
    id: chain.id,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    logoUrl: getChainLogo(chain.id),
  }));

  return chainsData.filter((chain) => SUPPORTED_CHAINS.includes(chain.id));
};