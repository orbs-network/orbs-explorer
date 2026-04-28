export type PerpetualHubOperation = {
  id: number;
  operationType: string;
  userAddress: string;
  symbol?: string;
  side?: string;
  quantity?: string;
  price?: string;
  amount?: string;
  fee?: string;
  realizedPnl?: string;
  status: string;
  rejectReason?: string;
  timestamp: number;
  teeSequence?: number;
  stateRoot?: string;
};

export type PerpetualHubTrade = {
  id: number;
  symbol?: string;
  side?: string;
  quantity?: string;
  price?: string;
  fee?: string;
  realizedPnl?: string;
  isClose?: boolean;
  timestamp: number;
};

export type PerpetualHubUserPosition = {
  symbol?: string;
  side?: string;
  quantity?: string;
  positionAmt?: string;
  entryPrice?: string;
  markPrice?: string;
  notional?: string;
  unrealizedPnl?: string;
  liquidationPrice?: string;
  maintenanceMargin?: string;
  leverage?: string | number;
};

export type PerpetualHubUserOrder = {
  orderId?: number | string;
  id?: number | string;
  symbol?: string;
  side?: string;
  orderType?: string;
  quantity?: string;
  price?: string;
  stopPrice?: string;
  status?: string;
  timestamp?: number;
};

export type PerpetualHubUserCurrent = {
  user?: {
    address: string;
    balance: string;
    nonce?: number;
  };
  positions: PerpetualHubUserPosition[];
  pendingOrders: PerpetualHubUserOrder[];
  availableBalance?: string;
  marginUsed?: string;
  maintenanceMargin?: string;
  marginBalance?: string;
  unrealizedPnl?: string;
  leveragePreferences?: Record<string, number>;
};

export type PerpetualHubUserDetail = {
  address: string;
  current?: PerpetualHubUserCurrent;
  history: {
    events: PerpetualHubOperation[];
    totalEvents: number;
    orders: PerpetualHubOperation[];
    totalOrders: number;
    trades: PerpetualHubTrade[];
    totalTrades: number;
    transactions: PerpetualHubOperation[];
    totalTransactions: number;
  };
  errors: string[];
  updatedAt: number;
};

export type PerpetualHubHedgerPosition = {
  symbol: string;
  positionSide?: string;
  positionAmt?: string;
  entryPrice?: string;
  unrealizedProfit?: string;
  leverage?: string;
  marginType?: string;
  initialMargin?: string;
  maintMargin?: string;
  notional?: string;
  updateTime?: number;
};

export type PerpetualHubSummary = {
  source: {
    backendUrl: string;
  };
  health: {
    backendStatus?: string;
    errors: string[];
  };
  sync: {
    teeRoot?: string;
    chainRoot?: string;
    teeSeq: number;
    chainSeq: number;
    sequenceGap: number;
    rootsMatch: boolean | null;
    pendingOps: number;
    nextRollupIn: number;
    lastRollupTime?: number;
    lastRollupError?: string;
    rollupPaused?: boolean;
    rollupPauseReason?: string;
  };
  activity: {
    totalEvents: number;
    byType: Record<string, number>;
    successEvents: number;
    rejectedEvents: number;
    rejectRate: number;
    topRejectReasons: { reason: string; count: number }[];
    recentEvents: PerpetualHubOperation[];
  };
  volume: {
    recentNotional: number;
    recentFees: number;
    recentRealizedPnl: number;
    bySymbol: { symbol: string; notional: number; count: number }[];
  };
  risk: {
    users: number;
    openPositions: number;
    pendingOrders: number;
    totalUserBalance: number;
    totalAvailableBalance: number;
    totalUnrealizedPnl: number;
    openInterest: number;
    nearLiquidationCount: number;
    platformFeesCollected: number;
    hedgerFeesCollected: number;
    totalFeesCollected: number;
    unavailableMetrics: string[];
    exposureBySymbol: {
      symbol: string;
      longNotional: number;
      shortNotional: number;
      netQuantity: number;
      positions: number;
    }[];
  };
  hedger: {
    connected: boolean | null;
    dryRun: boolean;
    walletBalance?: number;
    marginBalance?: number;
    availableBalance?: number;
    unrealizedPnl?: number;
    openPositions: number;
    positionNotional: number;
    positions: PerpetualHubHedgerPosition[];
    error?: string;
  };
  rollups: {
    totalRollups: number;
    totalOps: number;
    latestSequence: number;
    avgOpsPerRollup: number;
    latest: {
      id: number;
      txHash?: string;
      status: string;
      operationsCount: number;
      submittedAt: number;
      oldSequence: number;
      newSequence: number;
    }[];
  };
  proofs: {
    totalProofs: number;
    chainValid: boolean | null;
    pendingProofsSample: number;
    latestSequence: number;
  };
  updatedAt: number;
};

export type PerpetualHubRollup = {
  id: number;
  oldStateRoot?: string;
  newStateRoot?: string;
  txHash?: string;
  blockNumber?: number;
  status: string;
  operationsCount: number;
  submittedAt: number;
  confirmedAt?: number;
  oldSequence: number;
  newSequence: number;
};

export type PerpetualHubRollupDetail = {
  rollup: PerpetualHubRollup;
  operations: PerpetualHubOperation[];
};

export type PerpetualHubStateDetail = {
  sequenceNumber: number;
  merkleRoot?: string;
  source?: string;
  transition?: {
    sequenceNumber: number;
    prevRoot?: string;
    newRoot?: string;
    opType?: string;
    rollupId?: number;
    createdAt?: number;
  };
  metrics: {
    users: number;
    openPositions: number;
    pendingOrders: number;
    totalUserBalance: number;
    openInterest: number;
    platformFeesCollected: number;
    hedgerTotalDeposits: number;
    hedgerTotalWithdrawals: number;
    hedgerRealizedPnl: number;
  };
  exposureBySymbol: {
    symbol: string;
    longNotional: number;
    shortNotional: number;
    netQuantity: number;
    positions: number;
  }[];
  users: {
    address: string;
    balance: number;
    positions: number;
    pendingOrders: number;
  }[];
  updatedAt: number;
};
