import { NextResponse } from "next/server";
import type {
  PerpetualHubHedgerPosition,
  PerpetualHubOperation,
  PerpetualHubSummary,
} from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type RollupStatus = {
  lastSubmitTime?: number;
  lastOnChainRoot?: string;
  lastOnChainSeq?: number;
  teeRoot?: string;
  teeSeq?: number;
  pendingOps?: number;
  nextRollupIn?: number;
  lastError?: string;
  paused?: boolean;
  pauseReason?: string;
};

type ChainState = {
  merkleRoot?: string;
  sequenceNumber?: number;
  totalDeposits?: string;
  contractUsdcBalance?: string;
  teeAddress?: string;
};

type EventsResponse = {
  events?: PerpetualHubOperation[];
  total?: number;
  stats?: {
    totalEvents?: number;
    byType?: Record<string, number>;
  } | null;
};

type RollupsResponse = {
  rollups?: Array<{
    id: number;
    txHash?: string;
    status: string;
    operationsCount: number;
    submittedAt: number;
    oldSequence: number;
    newSequence: number;
  }>;
  stats?: {
    totalRollups?: number;
    totalOps?: number;
    latestSequence?: number;
    avgOpsPerRollup?: string | number;
  } | null;
};

type ProofsResponse = {
  entries?: Array<{ rollupId?: number; sequenceNumber?: number }>;
  total?: number;
  chainValid?: boolean;
};

type ReflectedState = {
  merkleRoot?: string;
  sequenceNumber?: number;
  hedger?: {
    totalFeesCollected?: string;
  };
  users?: Array<{
    user?: string;
    balance?: string;
    positions?: Array<{
      symbol: string;
      positionAmt?: string;
      entryPrice?: string;
      notional?: string;
    }>;
    pendingOrders?: unknown[];
  }>;
  platformFeesCollected?: string;
};

type ReflectedPosition = NonNullable<
  NonNullable<ReflectedState["users"]>[number]["positions"]
>[number];

type RiskExposureRow = {
  symbol: string;
  longNotional: number;
  shortNotional: number;
  netQuantity: number;
  hedgerQuantity: number;
  hedgerNotional: number;
  hedgeGap: number;
  hedgeStatus: "matched" | "missing" | "partial" | "hedger_only";
  positions: number;
};

type HedgeStatus = RiskExposureRow["hedgeStatus"];

type HedgerStatus = {
  connected?: boolean;
  dryRun?: boolean;
  account?: {
    totalWalletBalance?: string;
    totalUnrealizedProfit?: string;
    totalMarginBalance?: string;
    availableBalance?: string;
  } | null;
  positions?: PerpetualHubHedgerPosition[];
  error?: string;
};

const DEFAULT_BACKEND_URL = "https://perpsapi.orbs.network";
function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getBackendUrl() {
  return trimTrailingSlash(
    process.env.PERPETUAL_HUB_API_URL ||
      process.env.NEXT_PUBLIC_PERPETUAL_HUB_API_URL ||
      DEFAULT_BACKEND_URL
  );
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      return { error: `${response.status} ${response.statusText}` };
    }
    return { data: (await response.json()) as T };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isIntegerString(value: unknown) {
  return typeof value === "string" && /^-?\d+$/.test(value);
}

function amountToUsd(value: unknown) {
  const amount = toNumber(value);
  if (!amount) return 0;
  return isIntegerString(value) ? amount / 1e6 : amount;
}

function quantityToUnits(value: unknown) {
  const quantity = toNumber(value);
  if (!quantity) return 0;
  return isIntegerString(value) ? quantity / 1e8 : quantity;
}

function priceToUsd(value: unknown) {
  const price = toNumber(value);
  if (!price) return 0;
  return isIntegerString(value) ? price / 1e18 : price;
}

function eventNotional(event: PerpetualHubOperation): number {
  const amount = amountToUsd(event.amount);
  if (amount) return Math.abs(amount);
  const quantity = Math.abs(quantityToUnits(event.quantity));
  const price = Math.abs(priceToUsd(event.price));
  return quantity && price ? quantity * price : 0;
}

function countRejectReasons(events: PerpetualHubOperation[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const reason = event.rejectReason || "Unknown";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function summarizeVolume(events: PerpetualHubOperation[]) {
  const bySymbol = new Map<string, { notional: number; count: number }>();
  let recentNotional = 0;
  let recentFees = 0;
  let recentRealizedPnl = 0;

  for (const event of events) {
    const notional = eventNotional(event);
    recentNotional += notional;
    recentFees += Math.abs(toNumber(event.fee));
    recentRealizedPnl += toNumber(event.realizedPnl);
    if (event.symbol && notional) {
      const current = bySymbol.get(event.symbol) ?? { notional: 0, count: 0 };
      current.notional += notional;
      current.count += 1;
      bySymbol.set(event.symbol, current);
    }
  }

  return {
    recentNotional,
    recentFees,
    recentRealizedPnl,
    bySymbol: Array.from(bySymbol.entries())
      .map(([symbol, value]) => ({ symbol, ...value }))
      .sort((a, b) => b.notional - a.notional)
      .slice(0, 8),
  };
}

function positionNotional(position: ReflectedPosition) {
  const explicit = Math.abs(toNumber(position.notional));
  if (explicit) return explicit;
  const quantity = Math.abs(toNumber(position.positionAmt));
  const entry = Math.abs(toNumber(position.entryPrice));
  return quantity * entry;
}

function hedgeTolerance(quantity: number) {
  return Math.max(1e-8, Math.abs(quantity) * 1e-6);
}

function classifyHedgeStatus(
  netQuantity: number,
  hedgerQuantity: number
): HedgeStatus {
  const netAbs = Math.abs(netQuantity);
  const hedgeAbs = Math.abs(hedgerQuantity);
  const tolerance = hedgeTolerance(Math.max(netAbs, hedgeAbs));

  if (netAbs <= tolerance && hedgeAbs <= tolerance) return "matched";
  if (netAbs <= tolerance) return "hedger_only";
  if (hedgeAbs <= tolerance) return "missing";
  return Math.abs(netQuantity - hedgerQuantity) <= tolerance
    ? "matched"
    : "partial";
}

function summarizeRisk(
  state?: ReflectedState,
  hedgerPositions: PerpetualHubHedgerPosition[] = []
) {
  const exposure = new Map<string, RiskExposureRow>();

  let openPositions = 0;
  let pendingOrders = 0;
  let totalUserBalance = 0;
  const totalAvailableBalance = 0;
  const totalUnrealizedPnl = 0;
  let openInterest = 0;
  const nearLiquidationCount = 0;

  for (const user of state?.users ?? []) {
    totalUserBalance += toNumber(user.balance);
    pendingOrders += user.pendingOrders?.length ?? 0;

    for (const position of user.positions ?? []) {
      const quantity = toNumber(position.positionAmt);
      if (!quantity) continue;
      const notional = positionNotional(position);
      const symbolExposure = exposure.get(position.symbol) ?? {
        symbol: position.symbol,
        longNotional: 0,
        shortNotional: 0,
        netQuantity: 0,
        hedgerQuantity: 0,
        hedgerNotional: 0,
        hedgeGap: 0,
        hedgeStatus: "matched",
        positions: 0,
      } satisfies RiskExposureRow;
      if (quantity > 0) symbolExposure.longNotional += notional;
      else symbolExposure.shortNotional += notional;
      symbolExposure.netQuantity += quantity;
      symbolExposure.positions += 1;
      exposure.set(position.symbol, symbolExposure);

      openPositions += 1;
      openInterest += notional;
    }
  }

  for (const position of hedgerPositions) {
    const quantity = toNumber(position.positionAmt);
    if (!quantity) continue;
    const notional = Math.abs(toNumber(position.notional));
    const symbolExposure = exposure.get(position.symbol) ?? {
      symbol: position.symbol,
      longNotional: 0,
      shortNotional: 0,
      netQuantity: 0,
      hedgerQuantity: 0,
      hedgerNotional: 0,
      hedgeGap: 0,
      hedgeStatus: "matched",
      positions: 0,
    } satisfies RiskExposureRow;

    symbolExposure.hedgerQuantity += quantity;
    symbolExposure.hedgerNotional += notional;
    exposure.set(position.symbol, symbolExposure);
  }

  const exposureBySymbol = Array.from(exposure.values())
    .map((row) => {
      const hedgeGap = row.netQuantity - row.hedgerQuantity;
      return {
        ...row,
        hedgeGap,
        hedgeStatus: classifyHedgeStatus(row.netQuantity, row.hedgerQuantity),
      };
    })
    .sort(
      (a, b) =>
        b.longNotional +
        b.shortNotional +
        b.hedgerNotional -
        (a.longNotional + a.shortNotional + a.hedgerNotional)
    );
  const hedgeMismatchCount = exposureBySymbol.filter(
    (row) => row.hedgeStatus !== "matched"
  ).length;

  return {
    users: state?.users?.length ?? 0,
    openPositions,
    pendingOrders,
    totalUserBalance,
    totalAvailableBalance,
    totalUnrealizedPnl,
    openInterest,
    nearLiquidationCount,
    hedgeMismatchCount,
    platformFeesCollected: toNumber(state?.platformFeesCollected),
    hedgerFeesCollected: toNumber(state?.hedger?.totalFeesCollected),
    totalFeesCollected:
      toNumber(state?.platformFeesCollected) +
      toNumber(state?.hedger?.totalFeesCollected),
    unavailableMetrics: [
      "Available user balance",
      "User unrealized PnL",
      "Near-liquidation count",
    ],
    exposureBySymbol,
  };
}

function enrichEventsWithRollups(
  events: PerpetualHubOperation[],
  rollups: NonNullable<RollupsResponse["rollups"]>
) {
  const rollupsByID = new Map(rollups.map((rollup) => [rollup.id, rollup]));

  return events.map((event) => {
    const directRollup = event.rollupId
      ? rollupsByID.get(event.rollupId)
      : undefined;
    const sequenceRollup = event.teeSequence
      ? rollups.find(
          (rollup) =>
            event.teeSequence! > rollup.oldSequence &&
            event.teeSequence! <= rollup.newSequence
        )
      : undefined;
    const rollup = directRollup ?? sequenceRollup;
    if (!rollup) return event;

    return {
      ...event,
      rollupId: event.rollupId ?? rollup.id,
      rollupTxHash: rollup.txHash,
    };
  });
}

export async function GET() {
  const backendUrl = getBackendUrl();

  const [
    backendHealth,
    reflectedState,
    rollupStatus,
    chainState,
    events,
    successEvents,
    rejectedEvents,
    rejectedSample,
    rollups,
    eventRollups,
    proofs,
    hedger,
  ] = await Promise.all([
    fetchJson<{ status?: string }>(`${backendUrl}/health`),
    fetchJson<ReflectedState>(`${backendUrl}/get-last-state`),
    fetchJson<RollupStatus>(`${backendUrl}/api/v1/rollup/status`),
    fetchJson<ChainState>(`${backendUrl}/api/v1/chain/state`),
    fetchJson<EventsResponse>(`${backendUrl}/api/v1/events?limit=100&offset=0`),
    fetchJson<EventsResponse>(
      `${backendUrl}/api/v1/events?status=SUCCESS&limit=1&offset=0`
    ),
    fetchJson<EventsResponse>(
      `${backendUrl}/api/v1/events?status=REJECTED&limit=1&offset=0`
    ),
    fetchJson<EventsResponse>(
      `${backendUrl}/api/v1/events?status=REJECTED&limit=100&offset=0`
    ),
    fetchJson<RollupsResponse>(`${backendUrl}/api/v1/rollups?limit=10&offset=0`),
    fetchJson<RollupsResponse>(`${backendUrl}/api/v1/rollups?limit=100&offset=0`),
    fetchJson<ProofsResponse>(`${backendUrl}/api/v1/proofs?limit=100&offset=0`),
    fetchJson<HedgerStatus>(`${backendUrl}/api/v1/hedger/binance-status`),
  ]);

  const errors = [
    backendHealth.error && `Backend: ${backendHealth.error}`,
    reflectedState.error && `Reflected state: ${reflectedState.error}`,
    rollupStatus.error && `Rollup status: ${rollupStatus.error}`,
    chainState.error && `Chain state: ${chainState.error}`,
    events.error && `Events: ${events.error}`,
    rollups.error && `Rollups: ${rollups.error}`,
    eventRollups.error && `Event rollups: ${eventRollups.error}`,
    proofs.error && `Proofs: ${proofs.error}`,
    hedger.error && `Hedger: ${hedger.error}`,
  ].filter(Boolean) as string[];

  const eventRollupItems = eventRollups.data?.rollups ?? rollups.data?.rollups ?? [];
  const recentEvents = enrichEventsWithRollups(
    events.data?.events ?? [],
    eventRollupItems
  );
  const successTotal = successEvents.data?.total ?? 0;
  const rejectedTotal = rejectedEvents.data?.total ?? 0;
  const totalEvents =
    events.data?.stats?.totalEvents ?? successTotal + rejectedTotal;
  const rejectRate = totalEvents ? rejectedTotal / totalEvents : 0;
  const teeSeq = rollupStatus.data?.teeSeq ?? reflectedState.data?.sequenceNumber ?? 0;
  const chainSeq =
    chainState.data?.sequenceNumber ?? rollupStatus.data?.lastOnChainSeq ?? 0;
  const teeRoot = rollupStatus.data?.teeRoot ?? reflectedState.data?.merkleRoot;
  const chainRoot =
    chainState.data?.merkleRoot ?? rollupStatus.data?.lastOnChainRoot;
  const rootsMatch = teeRoot && chainRoot ? teeRoot === chainRoot : null;
  const rollupStats = rollups.data?.stats;
  const proofEntries = proofs.data?.entries ?? [];
  const hedgerAccount = hedger.data?.account;
  const hedgerPositions = hedger.data?.positions ?? [];

  const summary: PerpetualHubSummary = {
    source: { backendUrl },
    health: {
      backendStatus: backendHealth.data?.status,
      errors,
    },
    sync: {
      teeRoot,
      chainRoot,
      teeSeq,
      chainSeq,
      sequenceGap: Math.max(0, teeSeq - chainSeq),
      rootsMatch,
      pendingOps: rollupStatus.data?.pendingOps ?? Math.max(0, teeSeq - chainSeq),
      nextRollupIn: rollupStatus.data?.nextRollupIn ?? 0,
      lastRollupTime: rollupStatus.data?.lastSubmitTime,
      lastRollupError: rollupStatus.data?.lastError,
      rollupPaused: rollupStatus.data?.paused,
      rollupPauseReason: rollupStatus.data?.pauseReason,
    },
    activity: {
      totalEvents,
      byType: events.data?.stats?.byType ?? {},
      successEvents: successTotal,
      rejectedEvents: rejectedTotal,
      rejectRate,
      topRejectReasons: countRejectReasons(rejectedSample.data?.events ?? []),
      recentEvents,
    },
    volume: summarizeVolume(recentEvents),
    risk: summarizeRisk(reflectedState.data, hedgerPositions),
    hedger: {
      connected:
        typeof hedger.data?.connected === "boolean" ? hedger.data.connected : null,
      dryRun: Boolean(hedger.data?.dryRun),
      walletBalance: toNumber(hedgerAccount?.totalWalletBalance),
      marginBalance: toNumber(hedgerAccount?.totalMarginBalance),
      availableBalance: toNumber(hedgerAccount?.availableBalance),
      unrealizedPnl: toNumber(hedgerAccount?.totalUnrealizedProfit),
      openPositions: hedgerPositions.length,
      positionNotional: hedgerPositions.reduce(
        (sum, position) => sum + Math.abs(toNumber(position.notional)),
        0
      ),
      positions: hedgerPositions,
      error: hedger.data?.error,
    },
    rollups: {
      totalRollups: rollupStats?.totalRollups ?? 0,
      totalOps: rollupStats?.totalOps ?? 0,
      latestSequence: rollupStats?.latestSequence ?? 0,
      avgOpsPerRollup: toNumber(rollupStats?.avgOpsPerRollup),
      latest: rollups.data?.rollups ?? [],
    },
    proofs: {
      totalProofs: proofs.data?.total ?? 0,
      chainValid:
        typeof proofs.data?.chainValid === "boolean" ? proofs.data.chainValid : null,
      pendingProofsSample: proofEntries.filter((entry) => entry.rollupId == null)
        .length,
      latestSequence: Math.max(
        0,
        ...proofEntries.map((entry) => entry.sequenceNumber ?? 0)
      ),
    },
    updatedAt: Date.now(),
  };

  return NextResponse.json(summary);
}
