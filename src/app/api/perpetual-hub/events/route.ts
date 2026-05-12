import { NextResponse } from "next/server";
import { scaleOperation } from "@/lib/perpetual-hub/scale";
import type {
  PerpetualHubEventList,
  PerpetualHubOperation,
} from "@/lib/perpetual-hub/types";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const offset = clampOffset(searchParams.get("offset"));

  const upstream = new URL(`${getBackendUrl()}/api/v1/events`);
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("offset", String(offset));

  // Pass through supported filters verbatim. Upstream accepts:
  //   ?type=&symbol=&user=&status=
  for (const key of ["type", "symbol", "user", "status"] as const) {
    const value = searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  try {
    const response = await fetch(upstream, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }
    const raw = (await response.json()) as PerpetualHubEventList;
    // Apply boundary scaling — events carry the same raw quantity/price/amount
    // fields the user/state/rollup routes scale via scaleOperation.
    const data: PerpetualHubEventList = {
      ...raw,
      events: (raw.events ?? []).map(
        (event: PerpetualHubOperation) => scaleOperation(event)
      ),
    };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
