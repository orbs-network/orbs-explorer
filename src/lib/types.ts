/** Shared types used across both TWAP and Liquidity Hub. */

export enum Partners {
  SwapX = "swapx",
  H2Finance = "h2finance",
  SyncSwap = "syncswap",
  Quickswap = "quickswap",
  Spookyswap = "spookyswap",
  Lynex = "lynex",
  Thena = "thena",
  Arbidex = "arbidex",
  Chronos = "chronos",
  Baseswap = "baseswap",
  Pancakeswap = "pancakeswap",
  Sushiswap = "sushiswap",
  Dragonswap = "dragonswap",
  Retro = "retro",
  Fenix = "fenix",
  TeaFi = "teaFi",
  SparkDEX = "sparkdex",
  Blackhole = "blackhole",
  Yowie = "yowie",
  Nami = "nami",
  Kodiak = "kodiak",
  Pangolin = "pangolin",
}

export type Partner = {
  id: Partners;
  website: string;
  logo: string;
  name: string;
  identifiers: string[];
};

export type Token = {
  name?: string;
  symbol: string;
  decimals: number;
  address: string;
  logoUrl?: string;
};

export type Address = `0x${string}`;

/** Re-export TWAP types for backward compatibility. Import from @/lib/twap for new code. */
export {
  type ListOrder,
  type Order,
  type OrderMetadata,
  type OrderChunk,
  type OraclePricingDatum,
  type OraclePricingMessage,
  type OracleTokenAmount,
  type OracleSignature,
  type SignedOrder,
  type TriggerPriceOrderWitness,
  type TwapConfig,
  type ChainDexes,
  type ChainSpotConfig,
  type SpotConfig,
  type ParsedOrderChunk,
  Status,
  ChunkStatus,
  SpotOrderType,
} from "./twap/types";
