import { NextResponse } from "next/server";
import { scaleOperation } from "@/lib/perpetual-hub/scale";
import type { PerpetualHubRollupDetail } from "@/lib/perpetual-hub/types";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid rollup ID" }, { status: 400 });
  }

  try {
    const response = await fetch(`${getBackendUrl()}/api/v1/rollups/${id}`, {
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
    const raw = (await response.json()) as PerpetualHubRollupDetail;
    const detail: PerpetualHubRollupDetail = {
      rollup: raw.rollup,
      operations: (raw.operations ?? []).map(scaleOperation),
    };
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
