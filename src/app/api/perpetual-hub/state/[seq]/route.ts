import { NextResponse } from "next/server";
import type { PerpetualHubStateDetail } from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type StateBySequenceResponse = ReflectedState & {
  source?: string;
  transition?: {
    sequenceNumber: number;
    prevRoot?: string;
    newRoot?: string;
    opType?: string;
    rollupId?: number;
    createdAt?: number;
  };
};

type ReflectedState = {
  merkleRoot?: string;
  sequenceNumber?: number;
  hedger?: {
    totalDeposits?: string;
    totalWithdrawals?: string;
    realizedPnl?: string;
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

async function fetchJson<T>(url: string): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
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

function positionNotional(position: ReflectedPosition) {
  const explicit = Math.abs(toNumber(position.notional));
  if (explicit) return explicit;
  return Math.abs(toNumber(position.positionAmt)) * Math.abs(toNumber(position.entryPrice));
}

function summarizeState(state: ReflectedState) {
  const exposure = new Map<
    string,
    { longNotional: number; shortNotional: number; netQuantity: number; positions: number }
  >();
  let openPositions = 0;
  let pendingOrders = 0;
  let totalUserBalance = 0;
  let openInterest = 0;

  const users = (state.users ?? []).map((user) => {
    const userPositions = user.positions ?? [];
    const userPendingOrders = user.pendingOrders?.length ?? 0;
    totalUserBalance += toNumber(user.balance);
    pendingOrders += userPendingOrders;

    for (const position of userPositions) {
      const quantity = toNumber(position.positionAmt);
      if (!quantity) continue;
      const notional = positionNotional(position);
      const current = exposure.get(position.symbol) ?? {
        longNotional: 0,
        shortNotional: 0,
        netQuantity: 0,
        positions: 0,
      };
      if (quantity > 0) current.longNotional += notional;
      else current.shortNotional += notional;
      current.netQuantity += quantity;
      current.positions += 1;
      exposure.set(position.symbol, current);
      openPositions += 1;
      openInterest += notional;
    }

    return {
      address: user.user ?? "",
      balance: toNumber(user.balance),
      positions: userPositions.length,
      pendingOrders: userPendingOrders,
    };
  });

  return {
    metrics: {
      users: users.length,
      openPositions,
      pendingOrders,
      totalUserBalance,
      openInterest,
      platformFeesCollected: toNumber(state.platformFeesCollected),
      hedgerTotalDeposits: toNumber(state.hedger?.totalDeposits),
      hedgerTotalWithdrawals: toNumber(state.hedger?.totalWithdrawals),
      hedgerRealizedPnl: toNumber(state.hedger?.realizedPnl),
    },
    exposureBySymbol: Array.from(exposure.entries())
      .map(([symbol, value]) => ({ symbol, ...value }))
      .sort(
        (a, b) =>
          b.longNotional + b.shortNotional - (a.longNotional + a.shortNotional)
      ),
    users: users
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 50),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seq: string }> }
) {
  const { seq } = await params;
  if (!/^\d+$/.test(seq)) {
    return NextResponse.json({ error: "Invalid sequence number" }, { status: 400 });
  }

  const backendUrl = getBackendUrl();
  const stateResponse = await fetchJson<StateBySequenceResponse>(
    `${backendUrl}/api/v1/state/${seq}`
  );

  if (stateResponse.error || !stateResponse.data) {
    return NextResponse.json(
      { error: stateResponse.error || "State unavailable" },
      { status: 502 }
    );
  }

  const targetSeq = Number(seq);
  const state = stateResponse.data;
  const summary = summarizeState(state);

  const detail: PerpetualHubStateDetail = {
    sequenceNumber: state.sequenceNumber ?? targetSeq,
    merkleRoot: state.merkleRoot,
    source: state.source,
    transition: state.transition,
    ...summary,
    updatedAt: Date.now(),
  };

  return NextResponse.json(detail);
}
