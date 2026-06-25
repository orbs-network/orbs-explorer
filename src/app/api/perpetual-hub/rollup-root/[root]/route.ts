import { NextResponse } from "next/server";
import {
  resolvePerpetualHubDeployments,
  type PerpetualHubDeployment,
} from "@/lib/perpetual-hub/deployments";
import type { PerpetualHubRollup } from "@/lib/perpetual-hub/types";

type RollupsResponse = {
  rollups?: PerpetualHubRollup[];
  total?: number;
};

const PAGE_SIZE = 100;
const MAX_SCAN = 10_000;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function annotateRollup(
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

async function fetchRollups(deployment: PerpetualHubDeployment, offset: number) {
  const response = await fetch(
    `${trimTrailingSlash(
      deployment.backendUrl,
    )}/api/v1/rollups?limit=${PAGE_SIZE}&offset=${offset}`,
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
  request: Request,
  { params }: { params: Promise<{ root: string }> }
) {
  const { root } = await params;
  const { searchParams } = new URL(request.url);
  const normalizedRoot = root.trim().toLowerCase();

  if (!/^0x[a-fA-F0-9]{64}$/.test(root)) {
    return NextResponse.json({ error: "Invalid state root" }, { status: 400 });
  }

  const deployments = resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  });

  if (!deployments.length) {
    return NextResponse.json({ error: "No deployment matches filters" }, { status: 404 });
  }

  try {
    for (const deployment of deployments) {
      let offset = 0;
      while (offset < MAX_SCAN) {
        const page = await fetchRollups(deployment, offset);
        const rollups = page.rollups ?? [];
        const match = rollups.find(
          (rollup) => rollup.newStateRoot?.toLowerCase() === normalizedRoot
        );
        if (match) {
          return NextResponse.json({ rollup: annotateRollup(match, deployment) });
        }
        if (!rollups.length || offset + rollups.length >= (page.total ?? 0)) {
          break;
        }
        offset += PAGE_SIZE;
      }
    }

    return NextResponse.json({ error: "Rollup root not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
