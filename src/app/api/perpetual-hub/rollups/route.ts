import { NextResponse } from "next/server";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@/lib/perpetual-hub/deployments";
import type {
  PerpetualHubRollup,
  PerpetualHubRollupList,
  PerpetualHubRollupListStats,
} from "@/lib/perpetual-hub/types";

const UPSTREAM_PAGE_SIZE = 100;
const LOCAL_PAGE_BATCH_SIZE = 8;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

// The upstream caps limit at 100 and rejects negative offsets. Clamp on our
// side too so a bad URL gives a deterministic page-1 fallback instead of a
// 502 from the upstream's input rejection.
function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(Math.trunc(n), 100);
}

function clampOffset(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function withDeployment(
  rollup: PerpetualHubRollup,
  deployment: PerpetualHubDeployment,
): PerpetualHubRollup {
  return {
    ...rollup,
    partnerId: deployment.partnerId,
    partnerName: deployment.partnerName,
    chainId: deployment.chainId,
    chainName: deployment.chainName,
    contractAddress: deployment.contractAddress,
  };
}

function mergeStats(
  stats: Array<PerpetualHubRollupListStats | undefined>,
): PerpetualHubRollupListStats | undefined {
  let totalRollups = 0;
  let totalOps = 0;
  let latestSequence = 0;
  let totalAvgWeight = 0;
  let weightedAvg = 0;

  for (const stat of stats) {
    if (!stat) continue;
    totalRollups += stat.totalRollups;
    totalOps += stat.totalOps;
    latestSequence = Math.max(latestSequence, stat.latestSequence);
    const avg = Number(stat.avgOpsPerRollup);
    if (Number.isFinite(avg) && stat.totalRollups) {
      weightedAvg += avg * stat.totalRollups;
      totalAvgWeight += stat.totalRollups;
    }
  }

  if (!totalRollups && !totalOps && !latestSequence) return undefined;

  return {
    totalRollups,
    totalOps,
    latestSequence,
    avgOpsPerRollup: totalAvgWeight
      ? String(weightedAvg / totalAvgWeight)
      : "0",
  };
}

function rollupMatches(
  rollup: PerpetualHubRollup,
  filters: {
    status?: string;
    hash?: string;
  },
) {
  if (
    filters.status &&
    rollup.status.toLowerCase() !== filters.status.toLowerCase()
  ) {
    return false;
  }

  if (filters.hash) {
    const term = filters.hash.toLowerCase().replace(/^#/, "");
    const matchesId = String(rollup.id).includes(term);
    const matchesTx = rollup.txHash?.toLowerCase().includes(term);
    if (!matchesId && !matchesTx) return false;
  }

  return true;
}

async function fetchDeploymentRollups({
  deployment,
  limit,
  offset,
  signal,
}: {
  deployment: PerpetualHubDeployment;
  limit: number;
  offset: number;
  signal: AbortSignal;
}) {
  const upstream = new URL(
    `${trimTrailingSlash(deployment.backendUrl)}/api/v1/rollups`,
  );
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("offset", String(offset));

  const response = await fetch(upstream, {
    cache: "no-store",
    signal,
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as PerpetualHubRollupList;
  return {
    ...data,
    rollups: (data.rollups ?? []).map((rollup) =>
      withDeployment(rollup, deployment),
    ),
  };
}

async function fetchDeploymentRollupsWindow({
  deployment,
  targetCount,
  filters,
  signal,
}: {
  deployment: PerpetualHubDeployment;
  targetCount: number;
  filters: { status?: string; hash?: string };
  signal: AbortSignal;
}) {
  const rollups: PerpetualHubRollup[] = [];
  let stats: PerpetualHubRollupListStats | undefined;
  let total = 0;
  let offset = 0;
  let exhausted = false;
  const hasFilters = Boolean(filters.status || filters.hash);

  while (!exhausted && (hasFilters || rollups.length < targetCount)) {
    const remainingPages = Math.max(
      1,
      Math.ceil((targetCount - rollups.length) / UPSTREAM_PAGE_SIZE),
    );
    const pagesInBatch = hasFilters
      ? LOCAL_PAGE_BATCH_SIZE
      : Math.min(LOCAL_PAGE_BATCH_SIZE, remainingPages);
    const pageOffsets = Array.from(
      { length: pagesInBatch },
      (_, index) => offset + index * UPSTREAM_PAGE_SIZE,
    );

    const pages = await Promise.all(
      pageOffsets.map(async (pageOffset) => ({
        pageOffset,
        page: await fetchDeploymentRollups({
          deployment,
          limit: UPSTREAM_PAGE_SIZE,
          offset: pageOffset,
          signal,
        }),
      })),
    );

    for (const { pageOffset, page } of pages) {
      stats ??= page.stats;
      total = page.total ?? total;
      rollups.push(
        ...(page.rollups ?? []).filter((rollup) =>
          rollupMatches(rollup, filters),
        ),
      );

      offset = pageOffset + UPSTREAM_PAGE_SIZE;
      exhausted =
        (page.rollups ?? []).length < UPSTREAM_PAGE_SIZE ||
        (Boolean(page.total) && offset >= page.total);

      if (!hasFilters && (exhausted || rollups.length >= targetCount)) break;
    }
  }

  return {
    rollups,
    total: hasFilters ? rollups.length : total,
    stats,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const offset = clampOffset(searchParams.get("offset"));
  const deployments = resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  });
  const filters = {
    status: searchParams.get("status") || undefined,
    hash: searchParams.get("hash") || undefined,
  };

  if (!deployments.length) {
    return NextResponse.json({
      rollups: [],
      total: 0,
      limit,
      offset,
    } satisfies PerpetualHubRollupList);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const shouldPageLocally =
      deployments.length > 1 || Boolean(filters.status || filters.hash);

    const pages = await Promise.all(
      deployments.map((deployment) => {
        if (shouldPageLocally) {
          return fetchDeploymentRollupsWindow({
            deployment,
            targetCount: offset + limit,
            filters,
            signal: controller.signal,
          });
        }

        return fetchDeploymentRollups({
          deployment,
          limit,
          offset,
          signal: controller.signal,
        });
      }),
    );

    const filteredRollups = pages
      .flatMap((page) => page.rollups ?? [])
      .filter((rollup) => rollupMatches(rollup, filters))
      .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));

    const rollups = shouldPageLocally
      ? filteredRollups.slice(offset, offset + limit)
      : filteredRollups;

    return NextResponse.json({
      rollups,
      total: shouldPageLocally
        ? filteredRollups.length
        : pages.reduce((sum, page) => sum + (page.total ?? 0), 0),
      limit,
      offset,
      stats: mergeStats(pages.map((page) => page.stats)),
    } satisfies PerpetualHubRollupList);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
