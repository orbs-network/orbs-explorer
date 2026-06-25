import { NextResponse } from "next/server";
import {
  amountToUsd,
  priceToUsd,
  quantityToUnits,
  toNumber,
} from "@/lib/perpetual-hub/scale";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@/lib/perpetual-hub/deployments";
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
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
  const explicit = Math.abs(amountToUsd(position.notional));
  if (explicit) return explicit;
  const quantity = Math.abs(quantityToUnits(position.positionAmt));
  const entry = Math.abs(priceToUsd(position.entryPrice));
  return quantity * entry;
}

function summarizeRisk(state?: ReflectedState) {
  const exposure = new Map<
    string,
    {
      longNotional: number;
      shortNotional: number;
      netQuantity: number;
      positions: number;
    }
  >();

  let openPositions = 0;
  let pendingOrders = 0;
  let totalUserBalance = 0;
  const totalAvailableBalance = 0;
  const totalUnrealizedPnl = 0;
  let openInterest = 0;
  const nearLiquidationCount = 0;

  for (const user of state?.users ?? []) {
    totalUserBalance += amountToUsd(user.balance);
    pendingOrders += user.pendingOrders?.length ?? 0;

    for (const position of user.positions ?? []) {
      const quantity = quantityToUnits(position.positionAmt);
      if (!quantity) continue;
      const notional = positionNotional(position);
      const symbolExposure = exposure.get(position.symbol) ?? {
        longNotional: 0,
        shortNotional: 0,
        netQuantity: 0,
        positions: 0,
      };
      if (quantity > 0) symbolExposure.longNotional += notional;
      else symbolExposure.shortNotional += notional;
      symbolExposure.netQuantity += quantity;
      symbolExposure.positions += 1;
      exposure.set(position.symbol, symbolExposure);

      openPositions += 1;
      openInterest += notional;
    }
  }

  return {
    users: state?.users?.length ?? 0,
    openPositions,
    pendingOrders,
    totalUserBalance,
    totalAvailableBalance,
    totalUnrealizedPnl,
    openInterest,
    nearLiquidationCount,
    platformFeesCollected: amountToUsd(state?.platformFeesCollected),
    hedgerFeesCollected: amountToUsd(state?.hedger?.totalFeesCollected),
    totalFeesCollected:
      amountToUsd(state?.platformFeesCollected) +
      amountToUsd(state?.hedger?.totalFeesCollected),
    unavailableMetrics: [
      "Available user balance",
      "User unrealized PnL",
      "Near-liquidation count",
    ],
    exposureBySymbol: Array.from(exposure.entries())
      .map(([symbol, value]) => ({ symbol, ...value }))
      .sort(
        (a, b) =>
          b.longNotional + b.shortNotional - (a.longNotional + a.shortNotional),
      ),
  };
}

function enrichEventsWithRollups(
  events: PerpetualHubOperation[],
  rollups: NonNullable<RollupsResponse["rollups"]>,
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
            event.teeSequence! <= rollup.newSequence,
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

async function buildDeploymentSummary(
  deployment: PerpetualHubDeployment,
): Promise<PerpetualHubSummary> {
  const backendUrl = trimTrailingSlash(deployment.backendUrl);

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
      `${backendUrl}/api/v1/events?status=SUCCESS&limit=1&offset=0`,
    ),
    fetchJson<EventsResponse>(
      `${backendUrl}/api/v1/events?status=REJECTED&limit=1&offset=0`,
    ),
    fetchJson<EventsResponse>(
      `${backendUrl}/api/v1/events?status=REJECTED&limit=100&offset=0`,
    ),
    fetchJson<RollupsResponse>(
      `${backendUrl}/api/v1/rollups?limit=10&offset=0`,
    ),
    fetchJson<RollupsResponse>(
      `${backendUrl}/api/v1/rollups?limit=100&offset=0`,
    ),
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

  const eventRollupItems =
    eventRollups.data?.rollups ?? rollups.data?.rollups ?? [];
  const recentEvents = enrichEventsWithRollups(
    events.data?.events ?? [],
    eventRollupItems,
  );
  const successTotal = successEvents.data?.total ?? 0;
  const rejectedTotal = rejectedEvents.data?.total ?? 0;
  const totalEvents =
    events.data?.stats?.totalEvents ?? successTotal + rejectedTotal;
  const rejectRate = totalEvents ? rejectedTotal / totalEvents : 0;
  const teeSeq =
    rollupStatus.data?.teeSeq ?? reflectedState.data?.sequenceNumber ?? 0;
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
      pendingOps:
        rollupStatus.data?.pendingOps ?? Math.max(0, teeSeq - chainSeq),
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
    risk: summarizeRisk(reflectedState.data),
    hedger: {
      connected:
        typeof hedger.data?.connected === "boolean"
          ? hedger.data.connected
          : null,
      dryRun: Boolean(hedger.data?.dryRun),
      walletBalance: toNumber(hedgerAccount?.totalWalletBalance),
      marginBalance: toNumber(hedgerAccount?.totalMarginBalance),
      availableBalance: toNumber(hedgerAccount?.availableBalance),
      unrealizedPnl: toNumber(hedgerAccount?.totalUnrealizedProfit),
      openPositions: hedgerPositions.length,
      positionNotional: hedgerPositions.reduce(
        (sum, position) => sum + Math.abs(toNumber(position.notional)),
        0,
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
        typeof proofs.data?.chainValid === "boolean"
          ? proofs.data.chainValid
          : null,
      pendingProofsSample: proofEntries.filter(
        (entry) => entry.rollupId == null,
      ).length,
      latestSequence: Math.max(
        0,
        ...proofEntries.map((entry) => entry.sequenceNumber ?? 0),
      ),
    },
    updatedAt: Date.now(),
  };

  return summary;
}

function eventTimestampMs(event: PerpetualHubOperation) {
  return event.timestamp < 10_000_000_000
    ? event.timestamp * 1000
    : event.timestamp;
}

function mergeCounts(records: Array<Record<string, number>>) {
  const counts: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      counts[key] = (counts[key] ?? 0) + value;
    }
  }
  return counts;
}

function mergeRejectReasons(summaries: PerpetualHubSummary[]) {
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    for (const item of summary.activity.topRejectReasons) {
      counts.set(item.reason, (counts.get(item.reason) ?? 0) + item.count);
    }
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function mergeExposureBySymbol(summaries: PerpetualHubSummary[]) {
  const exposure = new Map<
    string,
    {
      longNotional: number;
      shortNotional: number;
      netQuantity: number;
      positions: number;
    }
  >();

  for (const summary of summaries) {
    for (const item of summary.risk.exposureBySymbol) {
      const current = exposure.get(item.symbol) ?? {
        longNotional: 0,
        shortNotional: 0,
        netQuantity: 0,
        positions: 0,
      };
      current.longNotional += item.longNotional;
      current.shortNotional += item.shortNotional;
      current.netQuantity += item.netQuantity;
      current.positions += item.positions;
      exposure.set(item.symbol, current);
    }
  }

  return Array.from(exposure.entries())
    .map(([symbol, value]) => ({ symbol, ...value }))
    .sort(
      (a, b) =>
        b.longNotional + b.shortNotional - (a.longNotional + a.shortNotional),
    );
}

function aggregateSummaries(summaries: PerpetualHubSummary[]) {
  const recentEvents = summaries
    .flatMap((summary) => summary.activity.recentEvents)
    .sort((a, b) => eventTimestampMs(b) - eventTimestampMs(a))
    .slice(0, 100);
  const successEvents = summaries.reduce(
    (sum, summary) => sum + summary.activity.successEvents,
    0,
  );
  const rejectedEvents = summaries.reduce(
    (sum, summary) => sum + summary.activity.rejectedEvents,
    0,
  );
  const totalEvents = summaries.reduce(
    (sum, summary) => sum + summary.activity.totalEvents,
    0,
  );
  const totalRollups = summaries.reduce(
    (sum, summary) => sum + summary.rollups.totalRollups,
    0,
  );
  const totalOps = summaries.reduce(
    (sum, summary) => sum + summary.rollups.totalOps,
    0,
  );
  const latestRollups = summaries
    .flatMap((summary) => summary.rollups.latest)
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 10);
  const allRootsKnown = summaries.every(
    (summary) => summary.sync.rootsMatch !== null,
  );
  const anyRootsDiffer = summaries.some(
    (summary) => summary.sync.rootsMatch === false,
  );
  const chainValidityValues = summaries.map(
    (summary) => summary.proofs.chainValid,
  );
  const allChainValidityKnown = chainValidityValues.every(
    (value) => value !== null,
  );
  const anyChainInvalid = chainValidityValues.some((value) => value === false);
  const hedgerConnectedValues = summaries.map(
    (summary) => summary.hedger.connected,
  );
  const anyHedgerDisconnected = hedgerConnectedValues.some(
    (value) => value === false,
  );
  const anyHedgerConnected = hedgerConnectedValues.some(
    (value) => value === true,
  );
  const nextRollupTimes = summaries
    .map((summary) => summary.sync.nextRollupIn)
    .filter((value) => value > 0);
  const healthySummaries = summaries.filter(
    (summary) => summary.health.backendStatus && !summary.health.errors.length,
  );
  const hasAnyBackendStatus = summaries.some(
    (summary) => summary.health.backendStatus,
  );

  return {
    source: {
      backendUrl: summaries
        .map((summary) => summary.source.backendUrl)
        .join(", "),
    },
    health: {
      backendStatus:
        healthySummaries.length === summaries.length
          ? "healthy"
          : hasAnyBackendStatus
            ? "degraded"
            : undefined,
      errors: summaries.flatMap((summary) =>
        summary.health.errors.map(
          (error) => `${summary.source.backendUrl}: ${error}`,
        ),
      ),
    },
    sync: {
      teeSeq: Math.max(0, ...summaries.map((summary) => summary.sync.teeSeq)),
      chainSeq: Math.max(
        0,
        ...summaries.map((summary) => summary.sync.chainSeq),
      ),
      sequenceGap: summaries.reduce(
        (sum, summary) => sum + summary.sync.sequenceGap,
        0,
      ),
      rootsMatch: allRootsKnown ? !anyRootsDiffer : null,
      pendingOps: summaries.reduce(
        (sum, summary) => sum + summary.sync.pendingOps,
        0,
      ),
      nextRollupIn: nextRollupTimes.length ? Math.min(...nextRollupTimes) : 0,
      lastRollupTime: Math.max(
        0,
        ...summaries.map((summary) => summary.sync.lastRollupTime ?? 0),
      ),
      lastRollupError: summaries
        .map((summary) => summary.sync.lastRollupError)
        .filter(Boolean)
        .join("; "),
      rollupPaused: summaries.some((summary) => summary.sync.rollupPaused),
      rollupPauseReason: summaries
        .map((summary) => summary.sync.rollupPauseReason)
        .filter(Boolean)
        .join("; "),
    },
    activity: {
      totalEvents,
      byType: mergeCounts(summaries.map((summary) => summary.activity.byType)),
      successEvents,
      rejectedEvents,
      rejectRate: totalEvents ? rejectedEvents / totalEvents : 0,
      topRejectReasons: mergeRejectReasons(summaries),
      recentEvents,
    },
    volume: summarizeVolume(recentEvents),
    risk: {
      users: summaries.reduce((sum, summary) => sum + summary.risk.users, 0),
      openPositions: summaries.reduce(
        (sum, summary) => sum + summary.risk.openPositions,
        0,
      ),
      pendingOrders: summaries.reduce(
        (sum, summary) => sum + summary.risk.pendingOrders,
        0,
      ),
      totalUserBalance: summaries.reduce(
        (sum, summary) => sum + summary.risk.totalUserBalance,
        0,
      ),
      totalAvailableBalance: summaries.reduce(
        (sum, summary) => sum + summary.risk.totalAvailableBalance,
        0,
      ),
      totalUnrealizedPnl: summaries.reduce(
        (sum, summary) => sum + summary.risk.totalUnrealizedPnl,
        0,
      ),
      openInterest: summaries.reduce(
        (sum, summary) => sum + summary.risk.openInterest,
        0,
      ),
      nearLiquidationCount: summaries.reduce(
        (sum, summary) => sum + summary.risk.nearLiquidationCount,
        0,
      ),
      platformFeesCollected: summaries.reduce(
        (sum, summary) => sum + summary.risk.platformFeesCollected,
        0,
      ),
      hedgerFeesCollected: summaries.reduce(
        (sum, summary) => sum + summary.risk.hedgerFeesCollected,
        0,
      ),
      totalFeesCollected: summaries.reduce(
        (sum, summary) => sum + summary.risk.totalFeesCollected,
        0,
      ),
      unavailableMetrics: Array.from(
        new Set(
          summaries.flatMap((summary) => summary.risk.unavailableMetrics),
        ),
      ),
      exposureBySymbol: mergeExposureBySymbol(summaries),
    },
    hedger: {
      connected: anyHedgerDisconnected
        ? false
        : anyHedgerConnected
          ? true
          : null,
      dryRun: summaries.some((summary) => summary.hedger.dryRun),
      walletBalance: summaries.reduce(
        (sum, summary) => sum + (summary.hedger.walletBalance ?? 0),
        0,
      ),
      marginBalance: summaries.reduce(
        (sum, summary) => sum + (summary.hedger.marginBalance ?? 0),
        0,
      ),
      availableBalance: summaries.reduce(
        (sum, summary) => sum + (summary.hedger.availableBalance ?? 0),
        0,
      ),
      unrealizedPnl: summaries.reduce(
        (sum, summary) => sum + (summary.hedger.unrealizedPnl ?? 0),
        0,
      ),
      openPositions: summaries.reduce(
        (sum, summary) => sum + summary.hedger.openPositions,
        0,
      ),
      positionNotional: summaries.reduce(
        (sum, summary) => sum + summary.hedger.positionNotional,
        0,
      ),
      positions: summaries.flatMap((summary) => summary.hedger.positions),
      error: summaries
        .map((summary) => summary.hedger.error)
        .filter(Boolean)
        .join("; "),
    },
    rollups: {
      totalRollups,
      totalOps,
      latestSequence: Math.max(
        0,
        ...summaries.map((summary) => summary.rollups.latestSequence),
      ),
      avgOpsPerRollup: totalRollups ? totalOps / totalRollups : 0,
      latest: latestRollups,
    },
    proofs: {
      totalProofs: summaries.reduce(
        (sum, summary) => sum + summary.proofs.totalProofs,
        0,
      ),
      chainValid: allChainValidityKnown ? !anyChainInvalid : null,
      pendingProofsSample: summaries.reduce(
        (sum, summary) => sum + summary.proofs.pendingProofsSample,
        0,
      ),
      latestSequence: Math.max(
        0,
        ...summaries.map((summary) => summary.proofs.latestSequence),
      ),
    },
    updatedAt: Date.now(),
  } satisfies PerpetualHubSummary;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deployments = resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  });

  if (!deployments.length) {
    return NextResponse.json(
      { error: "No Perpetual Hub deployment matches the selected filters" },
      { status: 404 },
    );
  }

  const summaries = await Promise.all(deployments.map(buildDeploymentSummary));
  return NextResponse.json(
    summaries.length === 1 ? summaries[0] : aggregateSummaries(summaries),
  );
}
