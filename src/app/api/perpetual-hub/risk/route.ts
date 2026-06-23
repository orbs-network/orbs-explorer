import { NextResponse } from "next/server";
import {
  amountToUsd,
  priceToUsd,
  quantityToUnits,
} from "@/lib/perpetual-hub/scale";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@/lib/perpetual-hub/deployments";
import type {
  PerpetualHubRiskExposure,
  PerpetualHubRiskList,
} from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type ReflectedState = {
  sequenceNumber?: number;
  users?: Array<{
    positions?: Array<{
      symbol: string;
      positionAmt?: string;
      entryPrice?: string;
      notional?: string;
    }>;
  }>;
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

function positionNotional(position: {
  positionAmt?: string;
  entryPrice?: string;
  notional?: string;
}) {
  const explicit = Math.abs(amountToUsd(position.notional));
  if (explicit) return explicit;
  return (
    Math.abs(quantityToUnits(position.positionAmt)) *
    Math.abs(priceToUsd(position.entryPrice))
  );
}

function exposureMatches(
  exposure: PerpetualHubRiskExposure,
  filters: {
    symbol?: string;
    minDollarValue?: number;
  },
) {
  if (
    filters.symbol &&
    !exposure.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
  ) {
    return false;
  }

  if (filters.minDollarValue !== undefined) {
    const total = exposure.longNotional + exposure.shortNotional;
    if (total < filters.minDollarValue) return false;
  }

  return true;
}

function buildRiskRows(
  state: ReflectedState,
  deployment: PerpetualHubDeployment,
) {
  const exposures = new Map<
    string,
    {
      longNotional: number;
      shortNotional: number;
      netQuantity: number;
      positions: number;
    }
  >();

  for (const user of state.users ?? []) {
    for (const position of user.positions ?? []) {
      const quantity = quantityToUnits(position.positionAmt);
      if (!quantity) continue;

      const current = exposures.get(position.symbol) ?? {
        longNotional: 0,
        shortNotional: 0,
        netQuantity: 0,
        positions: 0,
      };
      const notional = positionNotional(position);
      if (quantity > 0) current.longNotional += notional;
      else current.shortNotional += notional;
      current.netQuantity += quantity;
      current.positions += 1;
      exposures.set(position.symbol, current);
    }
  }

  return Array.from(exposures.entries()).map(
    ([symbol, exposure]): PerpetualHubRiskExposure => ({
      id: `${deployment.partnerId}-${deployment.chainId}-${symbol}`,
      symbol,
      ...exposure,
      sequenceNumber: state.sequenceNumber,
      partnerId: deployment.partnerId,
      partnerName: deployment.partnerName,
      chainId: deployment.chainId,
      chainName: deployment.chainName,
      contractAddress: deployment.contractAddress,
    }),
  );
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
    minDollarValue: Number.isFinite(minDollarValue)
      ? minDollarValue
      : undefined,
  };

  if (!deployments.length) {
    return NextResponse.json({
      exposures: [],
      total: 0,
      limit,
      offset,
      updatedAt: Date.now(),
    } satisfies PerpetualHubRiskList);
  }

  const stateResponses = await Promise.all(
    deployments.map(async (deployment) => ({
      deployment,
      response: await fetchJson<ReflectedState>(
        `${trimTrailingSlash(deployment.backendUrl)}/get-last-state`,
      ),
    })),
  );

  const firstError = stateResponses.find(
    (item) => item.response.error || !item.response.data,
  );
  if (firstError) {
    return NextResponse.json(
      {
        error:
          firstError.response.error ||
          `${firstError.deployment.partnerName} state unavailable`,
      },
      { status: 502 },
    );
  }

  const exposures = stateResponses
    .flatMap(({ deployment, response }) =>
      buildRiskRows(response.data!, deployment),
    )
    .filter((exposure) => exposureMatches(exposure, filters))
    .sort(
      (a, b) =>
        b.longNotional + b.shortNotional - (a.longNotional + a.shortNotional),
    );

  return NextResponse.json({
    exposures: exposures.slice(offset, offset + limit),
    total: exposures.length,
    limit,
    offset,
    updatedAt: Date.now(),
  } satisfies PerpetualHubRiskList);
}
