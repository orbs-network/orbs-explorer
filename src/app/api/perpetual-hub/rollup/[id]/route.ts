import { NextResponse } from "next/server";
import { scaleOperation } from "@/lib/perpetual-hub/scale";
import { resolvePerpetualHubDeployments } from "@/lib/perpetual-hub/deployments";
import type { PerpetualHubRollupDetail } from "@/lib/perpetual-hub/types";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveDeployment(request: Request) {
  const { searchParams } = new URL(request.url);
  return resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  })[0];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid rollup ID" }, { status: 400 });
  }

  try {
    const deployment = resolveDeployment(request);
    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 },
      );
    }
    const response = await fetch(
      `${trimTrailingSlash(deployment.backendUrl)}/api/v1/rollups/${id}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: `${response.status} ${response.statusText}` },
        { status: response.status },
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
      { status: 502 },
    );
  }
}
