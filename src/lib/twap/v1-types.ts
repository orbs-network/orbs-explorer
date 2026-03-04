/**
 * Old TWAP (v1) types from The Graph subgraph.
 * Based on spot-ui v1-orders and subgraph schema.
 */

export type RawStatus = "CANCELED" | "COMPLETED" | null;

export interface OrderV1 {
  id: string;
  twapAddress: string;
  Contract_id: number;
  ask_bidDelay?: string;
  ask_data?: string;
  ask_deadline: string;
  ask_dstMinAmount: string;
  ask_dstToken: string;
  ask_fillDelay: string;
  ask_exchange?: string;
  ask_srcToken: string;
  ask_srcBidAmount: string;
  ask_srcAmount: string;
  blockNumber?: string;
  blockTimestamp?: string;
  dex?: string;
  dollarValueIn?: string;
  dstTokenSymbol?: string;
  exchange: string;
  maker: string;
  srcTokenSymbol?: string;
  timestamp: string;
  transactionHash: string;
}

export interface FillV1 {
  id: string;
  dstAmountOut: string;
  dstFee?: string;
  srcFilledAmount?: string;
  twapAddress: string;
  exchange: string;
  TWAP_id: number;
  srcAmountIn: string;
  timestamp: number;
  transactionHash: string;
  dollarValueIn?: string;
  dollarValueOut?: string;
}

export interface OrderFill {
  inAmount: string;
  outAmount: string;
  timestamp: number;
  txHash: string;
}

export enum TwapV1OrderStatus {
  Completed = "completed",
  Open = "open",
  Canceled = "canceled",
  Expired = "expired",
}

export enum TwapV1OrderType {
  TWAP_MARKET = "twap_market",
  TWAP_LIMIT = "twap_limit",
  LIMIT = "limit",
}

/** Parsed v1 order for UI (matches spot-ui Order shape from buildV1Order). */
export interface TwapV1OrderParsed {
  version: 1;
  id: string;
  hash: string;
  type: TwapV1OrderType;
  srcTokenAddress: string;
  dstTokenAddress: string;
  exchangeAddress: string;
  twapAddress: string;
  maker: string;
  progress: number;
  dstAmountFilled: string;
  srcAmountFilled: string;
  orderDollarValueIn: string;
  srcAmount: string;
  dstMinAmountTotal: string;
  fills: OrderFill[];
  fillDelay: string;
  deadline: number;
  createdAt: number;
  dstMinAmountPerTrade: string;
  triggerPricePerTrade: string;
  srcAmountPerTrade: string;
  txHash: string;
  totalTradesAmount: number;
  isMarketPrice: boolean;
  chainId: number;
  filledOrderTimestamp: number;
  status: TwapV1OrderStatus;
  rawOrder: OrderV1;
}

/**
 * Display shape for old TWAP so the orders table can render it like ListOrder.
 * Table uses: hash, timestamp, totalUSDAmount, metadata.*, order.witness.chainId, inputToken, outputToken, exchangeAdapter.
 */
export interface TwapV1OrderDisplay {
  __source: "v1";
  hash: string;
  timestamp: string;
  totalUSDAmount: string;
  inputToken: string;
  outputToken: string;
  exchangeAdapter: string;
  metadata: {
    expectedChunks: number;
    chunkSummary: { success: number; total: number };
    status: string;
    orderType: string;
  };
  order: { witness: { chainId: number } };
  /** Original parsed v1 order for detail view */
  _raw?: TwapV1OrderParsed;
}

export interface GetV1OrdersFilters {
  /** Filter by exchange (adapter) address – current + legacy addresses */
  exchanges?: string[];
  accounts?: string[];
  inTokenSymbols?: string[];
  outTokenSymbols?: string[];
  inTokenAddresses?: string[];
  outTokenAddresses?: string[];
  transactionHashes?: string[];
  orderIds?: string[];
  minDollarValueIn?: string;
  startDate?: number;
  endDate?: number;
  orderType?: "limit" | "market";
  configs?: { twapAddress: string }[];
}
