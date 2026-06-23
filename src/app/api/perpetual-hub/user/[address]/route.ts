import { NextResponse } from "next/server";
import {
  scaleAccounting,
  scaleOperation,
  scaleTrade,
  scaleUserCurrent,
} from "@/lib/perpetual-hub/scale";
import { resolvePerpetualHubDeployments } from "@/lib/perpetual-hub/deployments";
import type {
  PerpetualHubOperation,
  PerpetualHubTrade,
  PerpetualHubUserCurrent,
  PerpetualHubUserDetail,
} from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type PaginatedOperations = {
  events?: PerpetualHubOperation[];
  transactions?: PerpetualHubOperation[];
  total?: number;
};

type PaginatedTrades = {
  trades?: PerpetualHubTrade[];
  total?: number;
};

type ReflectedState = {
  users?: Array<{
    user?: string;
    totalDeposits?: string;
    totalWithdrawals?: string;
    totalCommissionPaid?: string;
    totalFundingPaid?: string;
    realizedPnl?: string;
  }>;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveDeployment(request: Request) {
  const { searchParams } = new URL(request.url);
  return resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  })[0];
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid user address" },
      { status: 400 },
    );
  }

  const deployment = resolveDeployment(request);
  if (!deployment) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 },
    );
  }
  const backendUrl = trimTrailingSlash(deployment.backendUrl);
  const encodedAddress = encodeURIComponent(address);
  const [current, events, trades, transactions, reflectedState] =
    await Promise.all([
      fetchJson<PerpetualHubUserCurrent>(
        `${backendUrl}/api/v1/user/${encodedAddress}`,
      ),
      fetchJson<PaginatedOperations>(
        `${backendUrl}/api/v1/events?user=${encodedAddress}&limit=20&offset=0`,
      ),
      fetchJson<PaginatedTrades>(
        `${backendUrl}/api/v1/user/${encodedAddress}/trades?limit=20&offset=0`,
      ),
      fetchJson<PaginatedOperations>(
        `${backendUrl}/api/v1/user/${encodedAddress}/transactions?limit=20&offset=0`,
      ),
      fetchJson<ReflectedState>(`${backendUrl}/get-last-state`),
    ]);

  const errors = [
    current.error && `Current state: ${current.error}`,
    events.error && `Events: ${events.error}`,
    trades.error && `Trades: ${trades.error}`,
    transactions.error && `Transactions: ${transactions.error}`,
    reflectedState.error && `Reflected state: ${reflectedState.error}`,
  ].filter(Boolean) as string[];

  if (current.error && events.error && trades.error && transactions.error) {
    return NextResponse.json(
      { error: "User data unavailable", details: errors },
      { status: 502 },
    );
  }

  const rawAccounting = reflectedState.data?.users?.find(
    (user) => user.user?.toLowerCase() === address.toLowerCase(),
  );

  const detail: PerpetualHubUserDetail = {
    address,
    current: scaleUserCurrent(current.data),
    accounting: scaleAccounting(rawAccounting),
    history: {
      events: (events.data?.events ?? []).map(scaleOperation),
      totalEvents: events.data?.total ?? 0,
      trades: (trades.data?.trades ?? []).map(scaleTrade),
      totalTrades: trades.data?.total ?? 0,
      transactions: (transactions.data?.transactions ?? []).map(scaleOperation),
      totalTransactions: transactions.data?.total ?? 0,
    },
    errors,
    updatedAt: Date.now(),
  };

  return NextResponse.json(detail);
}
