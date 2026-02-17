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

export interface ListOrder {
  exchangeAdapter: string;
  hash: string;
  inputToken: string;
  outputToken: string;
  metadata: {
    chunkSummary: {
      error: number;
      lastChunkDescription: string;
      lastChunkDueTime: string; // ISO-8601
      lastChunkExtraError: boolean;
      lastChunkStatus: "success" | "error" | string;
      success: number;
      total: number;
    };
    description: string;
    displayOnlyPriceCheckPercentage: number | null;
    displayOnlyStatus: "SUCCEEDED" | string;
    displayOnlyStatusDescription: string;
    expectedChunks: number;
    orderType: "Market Order" | string;
    status: "completed" | "failed" | string;
    srcToken?: Token;
    dstToken?: Token;
  };
  order: {
    witness: {
      deadline: string; // unix timestamp (string)
      epoch: number;
    };
  };
  timestamp: string; // ISO-8601
  totalUSDAmount: string;
}

// Top-level payload
export interface Order {
  hash: `0x${string}`;
  metadata: OrderMetadata;
  order: SignedOrder;
  signature: `0x${string}`;
  timestamp: string; // ISO-8601
}

export interface OrderMetadata {
  chunks: OrderChunk[];
  description: string;
  displayOnlyInputTokenPriceUSD: string;
  displayOnlyStatus: string; // e.g. "SUCCEEDED"
  expectedChunks: number;
  instanceId: string;
  lastPriceCheck: string; // ISO-8601
  logLoopCounter: number;
  orderType: string; // e.g. "Trigger Price Order"
  status: string; // e.g. "completed"
}

export interface OrderChunk {
  blockId?: number;
  createdAt: string; // ISO-8601
  description?: string; // human-readable reason when status is failed or pending
  displayOnlyDueTime: string; // ISO-8601
  displayOnlyFee?: string; // e.g. "$0.07"
  epoch?: string;
  exchange?: `0x${string}`;
  executor?: `0x${string}`;
  extraTitle?: string;
  inAmount?: string; // big integer as decimal string (missing when chunk not yet filled)
  inToken?: `0x${string}`;
  index: number;
  minOut?: string;
  oraclePricingData?: OraclePricingDatum[];
  outAmount?: string;
  outToken?: `0x${string}`;
  settled?: boolean;
  status: string; // e.g. "success" | "failed" | "pending-price-check"
  swapper?: `0x${string}`;
  timestamp: string; // ISO-8601
  txHash?: `0x${string}`;
}

export interface OraclePricingDatum {
  message: OraclePricingMessage;
  oracle: `0x${string}`;
  oracleName: string; // e.g. "onchain-oracle" | "chainlink-oracle" | "1inch-oracle"
  signature: OracleSignature;
  timestamp: string; // ISO-8601
}

export interface OraclePricingMessage {
  chainid: number;
  cosigner: `0x${string}`;
  input: OracleTokenAmount;
  output: OracleTokenAmount;
  reactor: `0x${string}`;
  timestamp: number; // unix seconds
}

export interface OracleTokenAmount {
  decimals: number | string; // sample shows both
  token: `0x${string}`;
  value: number | string; // sample shows both (big ints may overflow JS number)
}

export interface OracleSignature {
  r: `0x${string}`;
  s: `0x${string}`;
  v: `0x${string}`; // sample has hex string like "0x1b"
}

export interface SignedOrder {
  deadline: string; // unix seconds as decimal string
  nonce: string; // decimal string
  permitted: {
    amount: string; // big integer as decimal string
    token: `0x${string}`;
  };
  spender: `0x${string}`;
  witness: TriggerPriceOrderWitness;
}

export interface TriggerPriceOrderWitness {
  chainid: number;
  deadline: string; // unix seconds as decimal string
  epoch: number;
  exchange: {
    adapter: `0x${string}`;
    data: `0x${string}`; // hex bytes
    ref: `0x${string}`;
    share: number;
  };
  exclusivity: number;
  executor: `0x${string}`;
  freshness: number;
  input: {
    amount: string; // big integer as decimal string
    maxAmount: string; // big integer as decimal string
    token: `0x${string}`;
  };
  nonce: string; // decimal string
  output: {
    limit: string; // big integer as decimal string
    recipient: `0x${string}`;
    stop: string; // big integer as decimal string
    token: `0x${string}`;
  };
  reactor: `0x${string}`;
  slippage: number;
  swapper: `0x${string}`;
}

export type Address = `0x${string}`;

export interface TwapConfig {
  type: string;
  adapter: Address;
  fee: Address;
}

export interface ChainDexes {
  [partner: string]: TwapConfig;
}

export interface ChainTwapConfig {
  dex?: ChainDexes;
}

export interface SaltConfig {
  wm: string;
  repermit: string;
  cosigner: string;
  reactor: string;
  executor: string;
  refinery: string;
  salt: SaltConfig;
}


export enum Status {
  COMPLETED = "completed",
  FAILED = "failed",
  PENDING = "pending",
  CANCELLED = "cancelled",
  PARTIALLY_COMPLETED = "partially_completed",
}

/** Chunk execution status from API. */
export enum ChunkStatus {
  SUCCESS = "success",
  FAILED = "failed",
  PENDING = "pending-price-check",
}


export type ParsedOrderChunk = {
  inAmountRaw: string;
  inAmountFormatted: string;
  outAmountRaw: string;
  outAmountFormatted: string;
  feesUsd: string;
  status: string;
  dueTime: string;
  createdAt: string;
  txHash: string;
  index: number;
  inToken: string;
  outToken: string;
  chainId?: number;
  /** Raw description from API; use formatChunkDescription() for display when status is failed or pending */
  description?: string;
};


export enum SpotOrderType {
  TAKE_PROFIT = "take_profit",
  STOP_LOSS_MARKET = "stop_loss_market",
  STOP_LOSS_LIMIT = "stop_loss_limit",
  LIMIT = "limit",
  TWAP_MARKET = "twap_market",
  TWAP_LIMIT = "twap_limit",
}



