import { NextResponse } from "next/server";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@/lib/perpetual-hub/deployments";
import { scaleOperation } from "@/lib/perpetual-hub/scale";
import type {
  PerpetualHubEventList,
  PerpetualHubEventListStats,
  PerpetualHubOperation,
} from "@/lib/perpetual-hub/types";

const UPSTREAM_PAGE_SIZE = 100;
const LOCAL_PAGE_BATCH_SIZE = 8;

type EventFetchScope = {
  deployment: PerpetualHubDeployment;
  eventType?: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

// Upstream caps limit at 100 (backend/internal/api/helpers.go:2016).
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

function timestampMs(value?: number) {
  if (!value) return 0;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function parseTimestampRange(value: string | null) {
  if (!value) return {};
  const [from, to] = value.split("-");
  const fromMs = Number(from);
  const toMs = Number(to);
  return {
    from: Number.isFinite(fromMs) && from ? fromMs : undefined,
    to: Number.isFinite(toMs) && to ? toMs : undefined,
  };
}

function withinTimestampRange(
  event: PerpetualHubOperation,
  range: { from?: number; to?: number },
) {
  if (!range.from && !range.to) return true;
  const value = timestampMs(event.timestamp);
  if (!value) return false;
  if (range.from && value < range.from) return false;
  if (range.to && value > range.to) return false;
  return true;
}

function mergeStats(
  stats: Array<PerpetualHubEventListStats | undefined>,
): PerpetualHubEventListStats | undefined {
  const merged: PerpetualHubEventListStats = {
    totalEvents: 0,
    byType: {},
  };

  for (const stat of stats) {
    if (!stat) continue;
    merged.totalEvents += stat.totalEvents;
    for (const [type, count] of Object.entries(stat.byType)) {
      merged.byType[type] = (merged.byType[type] ?? 0) + count;
    }
  }

  return merged.totalEvents || Object.keys(merged.byType).length
    ? merged
    : undefined;
}

function withDeployment(
  event: PerpetualHubOperation,
  deployment: PerpetualHubDeployment,
): PerpetualHubOperation {
  return {
    ...event,
    partnerId: deployment.partnerId,
    partnerName: deployment.partnerName,
    chainId: deployment.chainId,
    chainName: deployment.chainName,
    contractAddress: deployment.contractAddress,
  };
}

async function fetchDeploymentEvents({
  deployment,
  eventType,
  searchParams,
  limit,
  offset,
  signal,
}: {
  deployment: PerpetualHubDeployment;
  eventType?: string;
  searchParams: URLSearchParams;
  limit: number;
  offset: number;
  signal: AbortSignal;
}) {
  const upstream = new URL(
    `${trimTrailingSlash(deployment.backendUrl)}/api/v1/events`,
  );
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("offset", String(offset));

  // Pass through supported filters verbatim. Upstream accepts:
  //   ?type=&symbol=&user=&status=
  if (eventType) upstream.searchParams.set("type", eventType);
  for (const key of ["symbol", "user", "status"] as const) {
    const value = searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  const response = await fetch(upstream, {
    cache: "no-store",
    signal,
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as PerpetualHubEventList;

  return {
    ...raw,
    events: (raw.events ?? []).map((event) =>
      withDeployment(scaleOperation(event), deployment),
    ),
  };
}

async function fetchDeploymentEventsWindow({
  deployment,
  eventType,
  searchParams,
  targetCount,
  timestampRange,
  signal,
}: {
  deployment: PerpetualHubDeployment;
  eventType?: string;
  searchParams: URLSearchParams;
  targetCount: number;
  timestampRange: { from?: number; to?: number };
  signal: AbortSignal;
}) {
  const events: PerpetualHubOperation[] = [];
  let stats: PerpetualHubEventListStats | undefined;
  let total = 0;
  let offset = 0;
  let exhausted = false;
  const hasTimestampRange =
    timestampRange.from !== undefined || timestampRange.to !== undefined;

  while (!exhausted && events.length < targetCount) {
    const remainingPages = Math.max(
      1,
      Math.ceil((targetCount - events.length) / UPSTREAM_PAGE_SIZE),
    );
    const pagesInBatch = hasTimestampRange
      ? LOCAL_PAGE_BATCH_SIZE
      : Math.min(LOCAL_PAGE_BATCH_SIZE, remainingPages);
    const pageOffsets = Array.from(
      { length: pagesInBatch },
      (_, index) => offset + index * UPSTREAM_PAGE_SIZE,
    );

    const pages = await Promise.all(
      pageOffsets.map(async (pageOffset) => ({
        pageOffset,
        page: await fetchDeploymentEvents({
          deployment,
          eventType,
          searchParams,
          limit: UPSTREAM_PAGE_SIZE,
          offset: pageOffset,
          signal,
        }),
      })),
    );

    for (const { pageOffset, page } of pages) {
      stats ??= page.stats;
      total = page.total ?? total;

      const pageEvents = page.events ?? [];
      events.push(
        ...pageEvents.filter((event) =>
          withinTimestampRange(event, timestampRange),
        ),
      );

      const timestamps = pageEvents.map((event) =>
        timestampMs(event.timestamp),
      );
      const oldestTimestamp = timestamps.length ? Math.min(...timestamps) : 0;
      const fromTimestamp = timestampRange.from;
      const passedFromBoundary =
        fromTimestamp !== undefined &&
        Boolean(oldestTimestamp) &&
        oldestTimestamp < fromTimestamp;

      offset = pageOffset + UPSTREAM_PAGE_SIZE;
      exhausted =
        pageEvents.length < UPSTREAM_PAGE_SIZE ||
        (Boolean(page.total) && offset >= page.total) ||
        passedFromBoundary;

      if (exhausted || events.length >= targetCount) break;
    }
  }

  return { events, total, stats };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const offset = clampOffset(searchParams.get("offset"));
  const timestamp = searchParams.get("timestamp");
  const timestampRange = parseTimestampRange(timestamp);
  const deployments = resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  });
  const selectedTypes = searchParams.getAll("type").filter(Boolean);
  const scopes = deployments.flatMap<EventFetchScope>((deployment) =>
    selectedTypes.length
      ? selectedTypes.map((eventType) => ({ deployment, eventType }))
      : [{ deployment }],
  );

  if (!deployments.length) {
    return NextResponse.json({
      events: [],
      total: 0,
      limit,
      offset,
    } satisfies PerpetualHubEventList);
  }

  const shouldPageLocally = scopes.length > 1 || Boolean(timestamp);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const pages = await Promise.all(
      scopes.map(({ deployment, eventType }) => {
        if (shouldPageLocally) {
          return fetchDeploymentEventsWindow({
            deployment,
            eventType,
            searchParams,
            targetCount: offset + limit,
            timestampRange,
            signal: controller.signal,
          });
        }

        return fetchDeploymentEvents({
          deployment,
          eventType,
          searchParams,
          limit,
          offset,
          signal: controller.signal,
        });
      }),
    );

    const filteredEvents = pages
      .flatMap((page) => page.events ?? [])
      .filter((event) => withinTimestampRange(event, timestampRange))
      .sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp));

    const events = shouldPageLocally
      ? filteredEvents.slice(offset, offset + limit)
      : filteredEvents;

    const total =
      shouldPageLocally && timestamp
        ? filteredEvents.length
        : pages.reduce((sum, page) => sum + (page.total ?? 0), 0);

    return NextResponse.json({
      events,
      total,
      limit,
      offset,
      stats: mergeStats(pages.map((page) => page.stats)),
    } satisfies PerpetualHubEventList);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
