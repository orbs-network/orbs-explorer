import { NextResponse } from "next/server";
import type {
  PerpetualHubOperation,
  PerpetualHubTrade,
  PerpetualHubUserCurrent,
  PerpetualHubUserDetail,
} from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type PaginatedOperations = {
  events?: PerpetualHubOperation[];
  orders?: PerpetualHubOperation[];
  transactions?: PerpetualHubOperation[];
  total?: number;
};

type PaginatedTrades = {
  trades?: PerpetualHubTrade[];
  total?: number;
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
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid user address" }, { status: 400 });
  }

  const backendUrl = getBackendUrl();
  const encodedAddress = encodeURIComponent(address);
  const [
    current,
    events,
    orders,
    trades,
    transactions,
  ] = await Promise.all([
    fetchJson<PerpetualHubUserCurrent>(
      `${backendUrl}/api/v1/user/${encodedAddress}`
    ),
    fetchJson<PaginatedOperations>(
      `${backendUrl}/api/v1/events?user=${encodedAddress}&limit=20&offset=0`
    ),
    fetchJson<PaginatedOperations>(
      `${backendUrl}/api/v1/user/${encodedAddress}/orders/history?limit=20&offset=0`
    ),
    fetchJson<PaginatedTrades>(
      `${backendUrl}/api/v1/user/${encodedAddress}/trades?limit=20&offset=0`
    ),
    fetchJson<PaginatedOperations>(
      `${backendUrl}/api/v1/user/${encodedAddress}/transactions?limit=20&offset=0`
    ),
  ]);

  const errors = [
    current.error && `Current state: ${current.error}`,
    events.error && `Events: ${events.error}`,
    orders.error && `Order history: ${orders.error}`,
    trades.error && `Trades: ${trades.error}`,
    transactions.error && `Transactions: ${transactions.error}`,
  ].filter(Boolean) as string[];

  if (current.error && events.error && orders.error && trades.error && transactions.error) {
    return NextResponse.json(
      { error: "User data unavailable", details: errors },
      { status: 502 }
    );
  }

  const detail: PerpetualHubUserDetail = {
    address,
    current: current.data,
    history: {
      events: events.data?.events ?? [],
      totalEvents: events.data?.total ?? 0,
      orders: orders.data?.orders ?? [],
      totalOrders: orders.data?.total ?? 0,
      trades: trades.data?.trades ?? [],
      totalTrades: trades.data?.total ?? 0,
      transactions: transactions.data?.transactions ?? [],
      totalTransactions: transactions.data?.total ?? 0,
    },
    errors,
    updatedAt: Date.now(),
  };

  return NextResponse.json(detail);
}
