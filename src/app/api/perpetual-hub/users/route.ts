import { NextResponse } from "next/server";
import type {
  PerpetualHubUserCurrent,
  PerpetualHubUsers,
  PerpetualHubUserBalance,
} from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type RollupStatus = {
  lastOnChainSeq?: number;
  teeSeq?: number;
  pendingOps?: number;
};

type StateUsersResponse = {
  users?: Array<{ user?: string }>;
};

const DEFAULT_BACKEND_URL = "https://perpsapi.orbs.network";
const AMOUNT_SCALE = 1_000_000;

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
      signal: AbortSignal.timeout(15_000),
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

function scaleToUsd(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const str = String(value);
  if (!/^-?\d+$/.test(str)) {
    const parsed = Number(str);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed / AMOUNT_SCALE : 0;
}

export async function GET() {
  const backendUrl = getBackendUrl();

  const status = await fetchJson<RollupStatus>(
    `${backendUrl}/api/v1/rollup/status`
  );

  if (status.error || status.data?.lastOnChainSeq == null) {
    return NextResponse.json(
      {
        error: status.error || "Missing lastOnChainSeq",
      },
      { status: 502 }
    );
  }

  const onChainSeq = status.data.lastOnChainSeq;
  const teeSeq = status.data.teeSeq ?? null;
  const pendingOps = status.data.pendingOps ?? null;

  const stateRes = await fetchJson<StateUsersResponse>(
    `${backendUrl}/api/v1/state/${onChainSeq}`
  );

  if (stateRes.error) {
    return NextResponse.json(
      { error: `Failed to load state: ${stateRes.error}` },
      { status: 502 }
    );
  }

  const addresses = (stateRes.data?.users ?? [])
    .map((user) => user.user)
    .filter((addr): addr is string => typeof addr === "string");

  const userResults = await Promise.all(
    addresses.map(async (address) => {
      const detail = await fetchJson<PerpetualHubUserCurrent>(
        `${backendUrl}/api/v1/user/${encodeURIComponent(address)}`
      );
      return { address, detail };
    })
  );

  const rows: PerpetualHubUserBalance[] = userResults.map(({ address, detail }) => {
    if (detail.error || !detail.data) {
      return {
        address,
        ok: false,
        error: detail.error || "Missing user detail",
        wallet: 0,
        available: 0,
        marginUsed: 0,
        maintenanceMargin: 0,
        marginBalance: 0,
        unrealizedPnl: 0,
        positions: 0,
        orders: 0,
      };
    }

    const data = detail.data;
    return {
      address,
      ok: true,
      wallet: scaleToUsd(data.user?.balance),
      available: scaleToUsd(data.availableBalance),
      marginUsed: scaleToUsd(data.marginUsed),
      maintenanceMargin: scaleToUsd(data.maintenanceMargin),
      marginBalance: scaleToUsd(data.marginBalance),
      unrealizedPnl: scaleToUsd(data.unrealizedPnl),
      positions: data.positions?.length ?? 0,
      orders: data.pendingOrders?.length ?? 0,
    };
  });

  const funded = rows.filter(
    (row) =>
      !row.ok ||
      row.wallet > 0 ||
      row.marginBalance > 0 ||
      row.positions > 0 ||
      row.orders > 0
  );

  let totalWallet = 0;
  let totalMarginBalance = 0;
  let totalUnrealizedPnl = 0;
  for (const row of funded) {
    if (!row.ok) continue;
    totalWallet += row.wallet;
    totalMarginBalance += row.marginBalance;
    totalUnrealizedPnl += row.unrealizedPnl;
  }

  const payload: PerpetualHubUsers = {
    onChainSeq,
    teeSeq,
    pendingOps,
    totalUsers: rows.length,
    fundedUsers: funded.length,
    hiddenEmpty: rows.length - funded.length,
    totals: {
      wallet: totalWallet,
      marginBalance: totalMarginBalance,
      unrealizedPnl: totalUnrealizedPnl,
    },
    users: funded,
    updatedAt: Date.now(),
  };

  return NextResponse.json(payload);
}
