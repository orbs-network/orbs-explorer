import { findEvent } from "@orbs/domain/perpetual-hub/find-event";
import { NextResponse } from "next/server";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@orbs/domain/perpetual-hub/deployments";
import { scaleOperation } from "@orbs/domain/perpetual-hub/scale";
import type {
  PerpetualHubEventDetail,
  PerpetualHubEventList,
  PerpetualHubOperation,
} from "@orbs/domain/perpetual-hub/types";

const PAGE_SIZE = 100;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
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

async function fetchEventsPage({
  deployment,
  offset,
  signal,
}: {
  deployment: PerpetualHubDeployment;
  offset: number;
  signal: AbortSignal;
}) {
  const upstream = new URL(
    `${trimTrailingSlash(deployment.backendUrl)}/api/v1/events`,
  );
  upstream.searchParams.set("limit", String(PAGE_SIZE));
  upstream.searchParams.set("offset", String(offset));

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
    events: (raw.events ?? []).map((event) =>
      withDeployment(scaleOperation(event), deployment),
    ),
    total: raw.total ?? 0,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const eventId = Number(id);
  const { searchParams } = new URL(request.url);
  const seqParam = searchParams.get("seq");
  const seq = seqParam && /^\d+$/.test(seqParam) ? Number(seqParam) : undefined;
  const deployments = resolvePerpetualHubDeployments({
    partnerId: searchParams.getAll("partner_id"),
    chainId: searchParams.getAll("chain_id"),
    contract: searchParams.get("contract") || undefined,
  });

  if (!deployments.length) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const results = await Promise.allSettled(
      deployments.map((deployment) =>
        findEvent({
          id: eventId,
          seq,
          fetchPage: (offset) =>
            fetchEventsPage({ deployment, offset, signal: controller.signal }),
        }),
      ),
    );
    const event = results.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : [],
    )[0];
    if (!event) {
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    }

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      event,
      updatedAt: Date.now(),
    } satisfies PerpetualHubEventDetail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
