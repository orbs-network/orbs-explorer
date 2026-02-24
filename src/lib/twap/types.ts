import type { Token } from "../types";

export interface ListOrder {
  exchangeAdapter: string;
  hash: string;
  inputToken: string;
  outputToken: string;
  metadata: {
    chunkSummary: {
      error: number;
      lastChunkDescription: string;
      lastChunkDueTime: string;
      lastChunkExtraError: boolean;
      lastChunkStatus: "success" | "error" | string;
      success: number;
      total: number;
    };
    description: string;
    displayOnlyPriceCheckPercentage: number | null;
    displayOnlyStatus: string;
    displayOnlyStatusDescription: string;
    expectedChunks: number;
    orderType: string;
    status: string;
    srcToken?: Token;
    dstToken?: Token;
  };
  order: {
    witness: {
      deadline: string;
      epoch: number;
      chainId: number;
    };
  };
  timestamp: string;
  totalUSDAmount: string;
}

export interface Order {
  hash: `0x${string}`;
  metadata: OrderMetadata;
  order: SignedOrder;
  signature: `0x${string}`;
  timestamp: string;
}

export interface OrderMetadata {
  chunks: OrderChunk[];
  description: string;
  displayOnlyInputTokenPriceUSD: string;
  displayOnlyStatus: string;
  expectedChunks: number;
  instanceId: string;
  lastPriceCheck: string;
  logLoopCounter: number;
  orderType: string;
  status: string;
}

export interface OrderChunk {
  blockId?: number;
  createdAt: string;
  description?: string;
  displayOnlyDueTime: string;
  displayOnlyFee?: string;
  epoch?: string;
  exchange?: `0x${string}`;
  executor?: `0x${string}`;
  extraTitle?: string;
  extraTitleTranslated?: string;
  inAmount?: string;
  inToken?: `0x${string}`;
  index: number;
  minOut?: string;
  oraclePricingData?: OraclePricingDatum[];
  outAmount?: string;
  outToken?: `0x${string}`;
  settled?: boolean;
  status: string;
  swapper?: `0x${string}`;
  timestamp: string;
  txHash?: `0x${string}`;
  solverReportedOutput?: SolverReportData;
  transferFeeEstimation: {
    hasFeeOnTransfer: boolean;
    inputTokenFee: string;
    inputTokenReceived: string;
    error?: string;
  };
}

export interface OraclePricingDatum {
  message: OraclePricingMessage;
  oracle: `0x${string}`;
  oracleName: string;
  signature: OracleSignature;
  timestamp: string;
}

export interface OraclePricingMessage {
  chainid: number;
  cosigner: `0x${string}`;
  input: OracleTokenAmount;
  output: OracleTokenAmount;
  reactor: `0x${string}`;
  timestamp: number;
}

export interface OracleTokenAmount {
  decimals: number | string;
  token: `0x${string}`;
  value: number | string;
}

export interface OracleSignature {
  r: `0x${string}`;
  s: `0x${string}`;
  v: `0x${string}`;
}

export interface SignedOrder {
  deadline: string;
  nonce: string;
  permitted: {
    amount: string;
    token: `0x${string}`;
  };
  spender: `0x${string}`;
  witness: TriggerPriceOrderWitness;
}

export interface TriggerPriceOrderWitness {
  chainid: number;
  deadline: string;
  epoch: number;
  exchange: {
    adapter: `0x${string}`;
    data: `0x${string}`;
    ref: `0x${string}`;
    share: number;
  };
  exclusivity: number;
  executor: `0x${string}`;
  freshness: number;
  input: {
    amount: string;
    maxAmount: string;
    token: `0x${string}`;
  };
  nonce: string;
  output: {
    limit: string;
    recipient: `0x${string}`;
    stop: string;
    token: `0x${string}`;
  };
  reactor: `0x${string}`;
  slippage: number;
  swapper: `0x${string}`;
}

export interface TwapConfig {
  type: string;
  adapter: `0x${string}`;
  fee: `0x${string}`;
}

export interface ChainDexes {
  [partner: string]: TwapConfig;
}

export interface ChainSpotConfig {
  dex?: ChainDexes;
}

export interface SpotConfig {
  [chainId: string]: ChainSpotConfig;
}

export enum Status {
  COMPLETED = "completed",
  FAILED = "failed",
  PENDING = "pending",
  CANCELLED = "cancelled",
  PARTIALLY_COMPLETED = "partially_completed",
}

export enum ChunkStatus {
  SUCCESS = "success",
  FAILED = "failed",
  PENDING = "pending-price-check",
}

export type ParsedOrderChunk = {
  feeOnTransfer: string;
  feeOnTransferError?: string;
  updatedAt: string;
  inAmount: string;
  outAmount: string;
  feesUsd: string;
  status: string;
  dueTime: string;
  createdAt: string;
  txHash: string;
  index: number;
  inToken?: Token;
  outToken?: Token;
  chainId?: number;
  description?: string;
  blockId?: number;
  displayOnlyFee?: string;
  epoch?: string;
  exchange?: string;
  executor?: string;
  extraTitle?: string;
  minOut?: string;
  settled?: boolean;
  swapper?: string;
  oracleName?: string;
  oracleAddress?: string;
  inputTokenUsd?: string;
  outputTokenUsd?: string;
  solverOutAmount?: string;
  solverName?: string;
  oracleTimestamp?: string;
  minAmountOut?: string;
  exchangeRate?: string;
  expectedOutputOracle?: string;
  inputTotalUsd?: string;
  outputTotalUsd?: string;
  outAmountDiff?: string;
};

export enum SpotOrderType {
  TAKE_PROFIT = "take_profit",
  STOP_LOSS_MARKET = "stop_loss_market",
  STOP_LOSS_LIMIT = "stop_loss_limit",
  LIMIT = "limit",
  TWAP_MARKET = "twap_market",
  TWAP_LIMIT = "twap_limit",
}

type SolverReportData = {
  outputAmount: string;
  solverName: string;
  timestamp: string;
};
