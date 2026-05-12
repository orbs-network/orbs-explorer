import { NextResponse } from "next/server";
import type { PerpetualHubRollupList } from "@/lib/perpetual-hub/types";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const offset = clampOffset(searchParams.get("offset"));

  const upstream = new URL(`${getBackendUrl()}/api/v1/rollups`);
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("offset", String(offset));

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
    // Rollup fields are all metadata (ids, hashes, sequence numbers, counts,
    // timestamps) — no scaling needed.
    const data = (await response.json()) as PerpetualHubRollupList;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
