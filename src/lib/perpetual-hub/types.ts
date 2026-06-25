// Scaled numeric fields are returned as `number` by the explorer API routes
// (see `src/lib/perpetual-hub/scale.ts`). Legacy paths may still emit a
// string — the union keeps both shapes addressable without forcing every
// downstream consumer to narrow.
type ScaledNumber = number | string;

export type PerpetualHubOperation = {
  id: number;
  operationType: string;
  userAddress: string;
  symbol?: string;
  side?: string;
  quantity?: ScaledNumber;
  price?: ScaledNumber;
  amount?: ScaledNumber;
  fee?: ScaledNumber;
  realizedPnl?: ScaledNumber;
  status: string;
  rejectReason?: string;
  timestamp: number;
  teeSequence?: number;
  stateRoot?: string;
  rollupId?: number;
  rollupTxHash?: string;
  partnerId?: string;
  partnerName?: string;
  chainId?: number;
  chainName?: string;
  contractAddress?: string;
};

export type PerpetualHubTrade = {
  id: number;
  symbol?: string;
  side?: string;
  quantity?: ScaledNumber;
  price?: ScaledNumber;
  fee?: ScaledNumber;
  realizedPnl?: ScaledNumber;
  isClose?: boolean;
  timestamp: number;
};

export type PerpetualHubUserPosition = {
  symbol?: string;
  side?: string;
  quantity?: ScaledNumber;
  positionAmt?: ScaledNumber;
  entryPrice?: ScaledNumber;
  markPrice?: ScaledNumber;
  notional?: ScaledNumber;
  unrealizedPnl?: ScaledNumber;
  liquidationPrice?: ScaledNumber;
  maintenanceMargin?: ScaledNumber;
  leverage?: string | number;
  updateTime?: number;
};

export type PerpetualHubPosition = PerpetualHubUserPosition & {
  id: string;
  userAddress: string;
  sequenceNumber?: number;
  userBalance?: ScaledNumber;
  partnerId?: string;
  partnerName?: string;
  chainId?: number;
  chainName?: string;
  contractAddress?: string;
};

export type PerpetualHubPositionRecord = PerpetualHubPosition & {
  recordType: "position";
  status: "OPEN";
};

export type PerpetualHubPositionListFilters = {
  item_type?: string;
  symbol?: string;
  user?: string;
  side?: string;
  order_type?: string;
  min_dollar_value?: string;
  timestamp?: string;
  chain_id?: string;
  partner_id?: string;
  contract?: string;
};

export type PerpetualHubPositionList = {
  items: PerpetualHubPositionListItem[];
  positions: PerpetualHubPositionRecord[];
  orders: PerpetualHubOrderRecord[];
  total: number;
  limit: number;
  offset: number;
  sequenceNumber?: number;
  updatedAt: number;
};

export type PerpetualHubUserOrder = {
  orderId?: number | string;
  id?: number | string;
  clientOrderId?: number | string;
  symbol?: string;
  side?: string;
  type?: string;
  orderType?: string;
  quantity?: ScaledNumber;
  origQty?: ScaledNumber;
  executedQty?: ScaledNumber;
  price?: ScaledNumber;
  stopPrice?: ScaledNumber;
  status?: string;
  timeInForce?: string;
  reduceOnly?: boolean;
  closePosition?: boolean;
  time?: number;
  updateTime?: number;
  timestamp?: number;
};

export type PerpetualHubOrderRecord = Omit<PerpetualHubUserOrder, "id"> & {
  recordType: "order";
  id: string;
  userAddress: string;
  sequenceNumber?: number;
  quantity?: ScaledNumber;
  orderType?: string;
  timestamp?: number;
  notional?: ScaledNumber;
  partnerId?: string;
  partnerName?: string;
  chainId?: number;
  chainName?: string;
  contractAddress?: string;
};

export type PerpetualHubPositionListItem =
  | PerpetualHubPositionRecord
  | PerpetualHubOrderRecord;

export type PerpetualHubUserCurrent = {
  user?: {
    address: string;
    balance?: ScaledNumber;
    nonce?: number;
  };
  positions: PerpetualHubUserPosition[];
  pendingOrders: PerpetualHubUserOrder[];
  availableBalance?: ScaledNumber;
  marginUsed?: ScaledNumber;
  maintenanceMargin?: ScaledNumber;
  marginBalance?: ScaledNumber;
  unrealizedPnl?: ScaledNumber;
  leveragePreferences?: Record<string, number>;
};

export type PerpetualHubUserDetail = {
  address: string;
  current?: PerpetualHubUserCurrent;
  accounting?: {
    totalDeposits?: ScaledNumber;
    totalWithdrawals?: ScaledNumber;
    totalCommissionPaid?: ScaledNumber;
    totalFundingPaid?: ScaledNumber;
    realizedPnl?: ScaledNumber;
  };
  history: {
    events: PerpetualHubOperation[];
    totalEvents: number;
    trades: PerpetualHubTrade[];
    totalTrades: number;
    transactions: PerpetualHubOperation[];
    totalTransactions: number;
  };
  errors: string[];
  updatedAt: number;
};

export type PerpetualHubUserBalance = {
  address: string;
  ok: boolean;
  error?: string;
  partnerId?: string;
  partnerName?: string;
  chainId?: number;
  chainName?: string;
  contractAddress?: string;
  sequenceNumber?: number;
  wallet: number;
  available: number;
  marginUsed: number;
  maintenanceMargin: number;
  marginBalance: number;
  unrealizedPnl: number;
  positions: number;
  orders: number;
};

export type PerpetualHubUserListFilters = {
  user?: string;
  chain_id?: string;
  partner_id?: string;
  contract?: string;
  min_dollar_value?: string;
};

export type PerpetualHubUsers = {
  onChainSeq: number;
  teeSeq: number | null;
  pendingOps: number | null;
  total: number;
  limit: number;
  offset: number;
  totalUsers: number;
  fundedUsers: number;
  hiddenEmpty: number;
  totals: {
    wallet: number;
    marginBalance: number;
    unrealizedPnl: number;
  };
  users: PerpetualHubUserBalance[];
  updatedAt: number;
};

export type PerpetualHubHedgerPosition = {
  id?: string;
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
  partnerId?: string;
  partnerName?: string;
  chainId?: number;
  chainName?: string;
  contractAddress?: string;
  connected?: boolean | null;
  dryRun?: boolean;
};

export type PerpetualHubHedgerPositionListFilters = {
  symbol?: string;
  side?: string;
  min_dollar_value?: string;
  chain_id?: string;
  partner_id?: string;
  contract?: string;
};

export type PerpetualHubHedgerPositionList = {
  positions: PerpetualHubHedgerPosition[];
  total: number;
  limit: number;
  offset: number;
  updatedAt: number;
};

export type PerpetualHubRiskExposure = {
  id: string;
  symbol: string;
  longNotional: number;
  shortNotional: number;
  netQuantity: number;
  positions: number;
  sequenceNumber?: number;
  partnerId?: string;
  partnerName?: string;
  chainId?: number;
  chainName?: string;
  contractAddress?: string;
};

export type PerpetualHubRiskListFilters = {
  symbol?: string;
  min_dollar_value?: string;
  chain_id?: string;
  partner_id?: string;
  contract?: string;
};

export type PerpetualHubRiskList = {
  exposures: PerpetualHubRiskExposure[];
  total: number;
  limit: number;
  offset: number;
  updatedAt: number;
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
    hedgeMismatchCount: number;
    platformFeesCollected: number;
    hedgerFeesCollected: number;
    totalFeesCollected: number;
    unavailableMetrics: string[];
    exposureBySymbol: {
      symbol: string;
      longNotional: number;
      shortNotional: number;
      netQuantity: number;
      hedgerQuantity: number;
      hedgerNotional: number;
      hedgeGap: number;
      hedgeStatus: "matched" | "missing" | "partial" | "hedger_only";
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
  partnerId?: string;
  partnerName?: string;
  chainId?: number;
  chainName?: string;
  contractAddress?: string;
};

export type PerpetualHubRollupDetail = {
  rollup: PerpetualHubRollup;
  operations: PerpetualHubOperation[];
};

export type PerpetualHubRollupListStats = {
  totalRollups: number;
  totalOps: number;
  latestSequence: number;
  avgOpsPerRollup: string;
};

export type PerpetualHubRollupList = {
  rollups: PerpetualHubRollup[];
  total: number;
  limit: number;
  offset: number;
  stats?: PerpetualHubRollupListStats;
};

export type PerpetualHubRollupListFilters = {
  status?: string;
  hash?: string;
  chain_id?: string;
  partner_id?: string;
  contract?: string;
};

export type PerpetualHubEventListStats = {
  totalEvents: number;
  byType: Record<string, number>;
};

export type PerpetualHubEventListFilters = {
  type?: string | string[];
  symbol?: string;
  user?: string;
  status?: string;
  timestamp?: string;
  chain_id?: string;
  partner_id?: string;
  contract?: string;
};

export type PerpetualHubEventList = {
  events: PerpetualHubOperation[];
  total: number;
  limit: number;
  offset: number;
  stats?: PerpetualHubEventListStats;
};

export type PerpetualHubEventDetail = {
  event: PerpetualHubOperation;
  updatedAt: number;
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
