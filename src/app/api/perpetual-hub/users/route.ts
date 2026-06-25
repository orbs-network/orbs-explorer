import { NextResponse } from "next/server";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@/lib/perpetual-hub/deployments";
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
  sequenceNumber?: number;
};

const AMOUNT_SCALE = 1_000_000;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
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

function clampLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(Math.trunc(n), 100);
}

function clampOffset(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
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

function emptyPayload(
  limit: number | undefined,
  offset: number,
): PerpetualHubUsers {
  return {
    onChainSeq: 0,
    teeSeq: null,
    pendingOps: null,
    total: 0,
    limit: limit ?? 0,
    offset,
    totalUsers: 0,
    fundedUsers: 0,
    hiddenEmpty: 0,
    totals: {
      wallet: 0,
      marginBalance: 0,
      unrealizedPnl: 0,
    },
    users: [],
    updatedAt: Date.now(),
  };
}

function rowMatchesFilters(
  row: PerpetualHubUserBalance,
  filters: {
    user?: string;
    minDollarValue?: number;
  },
) {
  if (
    filters.user &&
    !row.address.toLowerCase().includes(filters.user.toLowerCase())
  ) {
    return false;
  }

  if (filters.minDollarValue !== undefined) {
    const value = Math.max(
      Math.abs(row.wallet),
      Math.abs(row.marginBalance),
      Math.abs(row.available),
    );
    if (value < filters.minDollarValue) return false;
  }

  return true;
}

function isFundedUser(row: PerpetualHubUserBalance) {
  return (
    row.wallet > 0 ||
    row.marginBalance > 0 ||
    row.available > 0 ||
    row.positions > 0 ||
    row.orders > 0
  );
}

async function fetchDeploymentUsers(deployment: PerpetualHubDeployment) {
  const backendUrl = trimTrailingSlash(deployment.backendUrl);
  const status = await fetchJson<RollupStatus>(
    `${backendUrl}/api/v1/rollup/status`,
  );

  if (status.error || status.data?.lastOnChainSeq == null) {
    throw new Error(
      `${deployment.partnerName}: ${status.error || "Missing lastOnChainSeq"}`,
    );
  }

  const onChainSeq = status.data.lastOnChainSeq;
  const teeSeq = status.data.teeSeq ?? null;
  const pendingOps = status.data.pendingOps ?? null;

  const stateRes = await fetchJson<StateUsersResponse>(
    `${backendUrl}/api/v1/state/${onChainSeq}`,
  );

  if (stateRes.error) {
    throw new Error(
      `${deployment.partnerName}: failed to load state: ${stateRes.error}`,
    );
  }

  const addresses = (stateRes.data?.users ?? [])
    .map((user) => user.user)
    .filter((addr): addr is string => typeof addr === "string");

  const userResults = await Promise.all(
    addresses.map(async (address) => {
      const detail = await fetchJson<PerpetualHubUserCurrent>(
        `${backendUrl}/api/v1/user/${encodeURIComponent(address)}`,
      );
      return { address, detail };
    }),
  );

  const withDeployment = (
    row: PerpetualHubUserBalance,
  ): PerpetualHubUserBalance => ({
    ...row,
    partnerId: deployment.partnerId,
    partnerName: deployment.partnerName,
    chainId: deployment.chainId,
    chainName: deployment.chainName,
    contractAddress: deployment.contractAddress,
    sequenceNumber: stateRes.data?.sequenceNumber ?? onChainSeq,
  });

  const rows: PerpetualHubUserBalance[] = userResults.map(
    ({ address, detail }) => {
      if (detail.error || !detail.data) {
        return withDeployment({
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
        });
      }

      const data = detail.data;
      return withDeployment({
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
      });
    },
  );

  return {
    onChainSeq,
    teeSeq,
    pendingOps,
    rows,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const offset = clampOffset(searchParams.get("offset"));
  const minDollarValue = Number(searchParams.get("min_dollar_value"));
  const deployments = resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  });
  const filters = {
    user: searchParams.get("user") || undefined,
    minDollarValue: Number.isFinite(minDollarValue)
      ? minDollarValue
      : undefined,
  };

  if (!deployments.length) {
    return NextResponse.json(emptyPayload(limit, offset));
  }

  let deploymentResults: Awaited<ReturnType<typeof fetchDeploymentUsers>>[];
  try {
    deploymentResults = await Promise.all(
      deployments.map((deployment) => fetchDeploymentUsers(deployment)),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }

  const rows = deploymentResults.flatMap((result) => result.rows);

  const fundedUsers = rows.filter(isFundedUser).length;
  const filtered = rows
    .filter((row) => rowMatchesFilters(row, filters))
    .sort((a, b) => {
      if (!a.ok && !b.ok) return 0;
      if (!a.ok) return 1;
      if (!b.ok) return -1;
      const fundedDiff = Number(isFundedUser(b)) - Number(isFundedUser(a));
      if (fundedDiff) return fundedDiff;
      const marginDiff = b.marginBalance - a.marginBalance;
      if (marginDiff) return marginDiff;
      const walletDiff = b.wallet - a.wallet;
      if (walletDiff) return walletDiff;
      return a.address.localeCompare(b.address);
    });

  let totalWallet = 0;
  let totalMarginBalance = 0;
  let totalUnrealizedPnl = 0;
  for (const row of filtered) {
    if (!row.ok) continue;
    totalWallet += row.wallet;
    totalMarginBalance += row.marginBalance;
    totalUnrealizedPnl += row.unrealizedPnl;
  }

  const pageUsers =
    limit === undefined ? filtered : filtered.slice(offset, offset + limit);

  const payload: PerpetualHubUsers = {
    onChainSeq: Math.max(
      0,
      ...deploymentResults.map((item) => item.onChainSeq),
    ),
    teeSeq:
      deploymentResults.length === 1
        ? (deploymentResults[0]?.teeSeq ?? null)
        : null,
    pendingOps: deploymentResults.reduce(
      (sum, item) => sum + (item.pendingOps ?? 0),
      0,
    ),
    total: filtered.length,
    limit: limit ?? filtered.length,
    offset,
    totalUsers: rows.length,
    fundedUsers,
    hiddenEmpty: 0,
    totals: {
      wallet: totalWallet,
      marginBalance: totalMarginBalance,
      unrealizedPnl: totalUnrealizedPnl,
    },
    users: pageUsers,
    updatedAt: Date.now(),
  };

  return NextResponse.json(payload);
}
