import { NextResponse } from "next/server";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@/lib/perpetual-hub/deployments";
import type {
  PerpetualHubHedgerPosition,
  PerpetualHubHedgerPositionList,
} from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type HedgerStatus = {
  connected?: boolean;
  dryRun?: boolean;
  positions?: PerpetualHubHedgerPosition[];
  error?: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
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

function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(Math.trunc(n), 100);
}

function clampOffset(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedSide(position: PerpetualHubHedgerPosition) {
  const amount = toNumber(position.positionAmt);
  if (amount > 0) return "long";
  if (amount < 0) return "short";
  return position.positionSide?.toLowerCase() || "flat";
}

function positionMatches(
  position: PerpetualHubHedgerPosition,
  filters: {
    symbol?: string;
    side?: string;
    minDollarValue?: number;
  },
) {
  if (
    filters.symbol &&
    !position.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
  ) {
    return false;
  }

  if (filters.side && normalizedSide(position) !== filters.side.toLowerCase()) {
    return false;
  }

  if (filters.minDollarValue !== undefined) {
    if (Math.abs(toNumber(position.notional)) < filters.minDollarValue) {
      return false;
    }
  }

  return true;
}

async function fetchDeploymentHedger(deployment: PerpetualHubDeployment) {
  const response = await fetchJson<HedgerStatus>(
    `${trimTrailingSlash(deployment.backendUrl)}/api/v1/hedger/binance-status`,
  );

  const positions = response.data?.positions ?? [];
  return positions.map((position, index): PerpetualHubHedgerPosition => {
    const side =
      position.positionSide ?? normalizedSide(position).toUpperCase();
    return {
      ...position,
      id: `${deployment.partnerId}-${deployment.chainId}-${position.symbol}-${index}`,
      positionSide: side,
      partnerId: deployment.partnerId,
      partnerName: deployment.partnerName,
      chainId: deployment.chainId,
      chainName: deployment.chainName,
      contractAddress: deployment.contractAddress,
      connected:
        typeof response.data?.connected === "boolean"
          ? response.data.connected
          : response.error
            ? false
            : null,
      dryRun: Boolean(response.data?.dryRun),
    };
  });
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
    symbol: searchParams.get("symbol") || undefined,
    side: searchParams.get("side") || undefined,
    minDollarValue: Number.isFinite(minDollarValue)
      ? minDollarValue
      : undefined,
  };

  if (!deployments.length) {
    return NextResponse.json({
      positions: [],
      total: 0,
      limit,
      offset,
      updatedAt: Date.now(),
    } satisfies PerpetualHubHedgerPositionList);
  }

  const positions = (
    await Promise.all(
      deployments.map((deployment) => fetchDeploymentHedger(deployment)),
    )
  )
    .flat()
    .filter((position) => positionMatches(position, filters))
    .sort(
      (a, b) => Math.abs(toNumber(b.notional)) - Math.abs(toNumber(a.notional)),
    );

  return NextResponse.json({
    positions: positions.slice(offset, offset + limit),
    total: positions.length,
    limit,
    offset,
    updatedAt: Date.now(),
  } satisfies PerpetualHubHedgerPositionList);
}
