/* eslint-disable @typescript-eslint/no-explicit-any */
export type LiquidityHubSwap = {
  amountInUSD2: number;
  remote_addr: string;
  amountOut: number;
  tokenInAddress: string;
  timeAbsolute: number;
  delta: number;
  type: string;
  userAgent?: string;
  amountOutSwap: number;
  timeToDecayEnd: number;
  simulateAmountOut: number;
  estimateGasSuccess: boolean;
  hostname: string;
  version: string;
  abtest: string;
  feeOutAmount: number;
  dex: string;
  amountOutUI: number;
  slippage: number;
  txHash: string;
  amountOutF: number;
  maxTries: number;
  exactOutAmountSavingsUsd2: number;
  auctionData: {
    amountOut: string[];
    amountOutF: string[];
    exchange: string[];
    simulateAmountOut: string[];
    swapData: string[];
    elapsed: number[];
  };
  ip: string;
  tokenOutSymbol: string;
  tokenOutAddress: string;
  dexSimulateOutMinusGas: number;
  amountInUSD?: number;
  tokenInName: string;
  exactOutAmountSavingsUsd: number;
  dollarValue2: number;
  feeOutAmountUsd: number;
  isDexPriceDifferentFromReference: boolean;
  country: string;
  signature: string;
  outUsd: number;
  dexRouteData: string;
  normalizedInUsd: number;
  inUsd2: number;
  referencePrice: number;
  swapStatus: string;
  exactOutAmount: number;
  sessionId: string;
  exactOutAmountSavings: number;
  amountIn: number;
  exchange: string;
  feeAmount: number;
  gasPriceGwei: number;
  stage: string;
  blockNumber: number;
  serializedOrder: string;
  normalizedInUsd2: number;
  userHasFunds: boolean;
  referer: string;
  dexRouteTo: string;
  ua: string;
  user: string;
  gasUsed: number;
  feeData: string;
  tryIndex: number;
  txStatus: string;
  chainId: number;
  exactOutAmountUsd: number;
  feeOutAmountUsd2: number;
  tokenOutName: string;
  tokenInSymbol: string;
  simulateOut: number;
  timeTillDecayStart: number;
  origin: string;
  took: number;
  timeAbsoluteEnd: number;
  timestamp: string;
  error?: string;
  rawStr: {
    route: {
      totalGasUnits: number | null;
      gasPrice: number | null;
      solverGasUnits: number;
      simulatorGasUnits: number | null;
      parsedRoute: {
        to: string;
        data: string;
        amountOut: string;
        supportFeeOnTransfer: boolean;
      };
      solver: string;
      filler: string;
      orderId: string;
      solverId: string | null;
      isFeeRoute: boolean;
      minAmountOut: number;
      amountIn: string;
      amountOut: string;
      swapRecipient: string;
      simulatorPreSwapCalls: unknown; // define if known
      minAmountOutWU: number;
      amountInWU: number;
      amountOutWU: number;
      routeTokens: string[];
      tokenIn: string;
      tokenInDecimals: string;
      tokenOut: string;
      tokenOutDecimals: string;
      rawData: {
        code: number;
        data: {
          inToken: {
            address: string;
            decimals: number;
            symbol: string;
            name: string;
            usd: string;
            volume: number;
          };
          outToken: {
            address: string;
            decimals: number;
            symbol: string;
            name: string;
            usd: string;
            volume: number;
          };
          inAmount: string;
          outAmount: string;
          estimatedGas: number;
          minOutAmount: string;
          from: string;
          to: string;
          value: string;
          gasPrice: string;
          data: string;
          chainId: number;
          rfqDeadline: number;
          gmxFee: number;
          blockNumber: number;
          price_impact: string;
        };
      };
      calculationElapsed: number;
    };
  };
};


export interface LiquidityHubQuote {
    remote_addr: string;
    amountOut: number;
    swapExactOutAmountSavingsUsd: number;
    tokenInAddress: string;
    swapExactOutAmount: number;
    type: string;
    simulateAmountOut: number;
    hostname: string;
    version: string;
    abtest: string;
    dex: string;
    swapExchage: string;
    amountOutUI: number;
    auctionData: {
      gasCostUsd: number[];
      amountOut: string[];
      gasCost: string[];
      amountOutF: string[];
      gasUnits: string[];
      simulateAmountOut: string[];
      exchange: string[];
      elapsed: number[];
      gasCostF: string[];
    };
    slippage: number;
    solverStages: {
      odos: string;
      openocean: string;
      magpie: string;
      paraswap: string;
      rango: string;
      unizen: string;
      zerox: string;
    };
    ip: string;
    tokenOutSymbol: string;
    swapTxData: string;
    versionRaw: string;
    tokenOutAddress: string;
    userAddress: string;
    shouldLHwin: boolean;
    amountInUSD: number;
    dollarValue2: number;
    shouldLHwinNs: boolean;
    country: string;
    isAuction: boolean;
    swapStage: string;
    updatedErrorTypes: {
      action: string[];
      exchange: string[];
    };
    outUsd: number;
    gasPrice: number;
    normalizedInUsd: number;
    inUsd2: number;
    isError: boolean;
    swapStatus: string;
    sessionId: string;
    auctionWinner: string;
    amountIn: number;
    amountInF: number;
    swapEstimateGasElapsed: number;
    serializedOrder: string;
    normalizedInUsd2: number;
    userHasFunds: boolean;
    referer: string;
    ua: string;
    swapFeeAmount: number;
    swapExactOutAmountSavings: number;
    swapFeeOutAmountUsd: number;
    swapTxStatus: string;
    chainId: number;
    gasCostUsd: number;
    hasSwap: boolean;
    swapTxHash: string;
    tokenInSymbol: string;
    error: string;
    swapExactOutAmountUsd: number;
    took: number;
    dollarValue: number;
    swapFeeOutAmount: number;
    timestamp: string;
    minAmountOutUI: number;
    gasUnits: number;
  }


  export interface TransferLog {
    from: string;
    to: string;
    tokenAddress: string;
    value: string;
  }
  


  export type SwapQueryResponse = {
    swap: LiquidityHubSwap;
    quotes: LiquidityHubQuote[];
    clientLogs: any[];
    quote?: LiquidityHubQuote;
  }

export type AmountFieldValue = {
  value: string | number;
  address: string;
  chainId: number;
  usd: string;
};

export type AvatarFieldValue = {
  logoUrl: string;
  value: string;
};

export type AddressFieldValue = {
  value: string;
  chainId: number;
  type: "address" | "tx";
};

export interface Field {
  title: string;
  subtitle: string;
  tooltip?: string;
  type: "text" | "avatar" | "amount" | "address";
  value: (
    data: SwapQueryResponse
  ) =>
    | string
    | number
    | AmountFieldValue
    | AvatarFieldValue
    | AddressFieldValue;
}
