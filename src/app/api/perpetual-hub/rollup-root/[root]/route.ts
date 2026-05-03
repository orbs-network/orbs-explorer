import { NextResponse } from "next/server";
import type { PerpetualHubRollup } from "@/lib/perpetual-hub/types";

type RollupsResponse = {
  rollups?: PerpetualHubRollup[];
  total?: number;
};

const DEFAULT_BACKEND_URL = "https://perpsapi.orbs.network";
const PAGE_SIZE = 100;
const MAX_SCAN = 10_000;

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

async function fetchRollups(offset: number) {
  const response = await fetch(
    `${getBackendUrl()}/api/v1/rollups?limit=${PAGE_SIZE}&offset=${offset}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as RollupsResponse;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ root: string }> }
) {
  const { root } = await params;
  const normalizedRoot = root.trim().toLowerCase();

  if (!/^0x[a-fA-F0-9]{64}$/.test(root)) {
    return NextResponse.json({ error: "Invalid state root" }, { status: 400 });
  }

  try {
    let offset = 0;
    while (offset < MAX_SCAN) {
      const page = await fetchRollups(offset);
      const rollups = page.rollups ?? [];
      const match = rollups.find(
        (rollup) => rollup.newStateRoot?.toLowerCase() === normalizedRoot
      );
      if (match) {
        return NextResponse.json({ rollup: match });
      }
      if (!rollups.length || offset + rollups.length >= (page.total ?? 0)) {
        break;
      }
      offset += PAGE_SIZE;
    }

    return NextResponse.json({ error: "Rollup root not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
