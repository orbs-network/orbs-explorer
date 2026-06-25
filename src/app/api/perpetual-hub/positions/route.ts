import { NextResponse } from "next/server";
import {
  amountToUsd,
  quantityToUnits,
  scalePosition,
} from "@/lib/perpetual-hub/scale";
import {
  type PerpetualHubDeployment,
  resolvePerpetualHubDeployments,
} from "@/lib/perpetual-hub/deployments";
import type {
  PerpetualHubOrderRecord,
  PerpetualHubPosition,
  PerpetualHubPositionList,
  PerpetualHubPositionListItem,
  PerpetualHubPositionRecord,
  PerpetualHubUserOrder,
  PerpetualHubUserPosition,
} from "@/lib/perpetual-hub/types";

type FetchResult<T> = { data?: T; error?: string };

type ReflectedState = {
  merkleRoot?: string;
  sequenceNumber?: number;
  users?: Array<{
    user?: string;
    balance?: string;
    positions?: PerpetualHubUserPosition[];
    pendingOrders?: PerpetualHubUserOrder[];
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

function toNumeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isIntegerString(value: unknown) {
  return typeof value === "string" && /^-?\d+$/.test(value);
}

function maybeScaledQuantity(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const quantity = toNumeric(value);
  if (!quantity) return quantity;
  return isIntegerString(value) && Math.abs(quantity) >= 1e8
    ? quantity / 1e8
    : quantity;
}

function maybeScaledPrice(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const price = toNumeric(value);
  if (!price) return price;
  return isIntegerString(value) && Math.abs(price) >= 1e12
    ? price / 1e18
    : price;
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

function sideFromQuantity(quantity: number) {
  if (quantity > 0) return "LONG";
  if (quantity < 0) return "SHORT";
  return "FLAT";
}

function normalizedSide(side?: string) {
  const value = side?.toLowerCase();
  if (!value) return "";
  if (value.includes("long") || value.includes("buy")) return "long";
  if (value.includes("short") || value.includes("sell")) return "short";
  return value;
}

function positionMatches(
  item: PerpetualHubPositionListItem,
  filters: {
    itemType?: string;
    user?: string;
    symbol?: string;
    side?: string;
    orderType?: string;
    minDollarValue?: number;
    timestampRange: { from?: number; to?: number };
  },
) {
  if (filters.itemType && item.recordType !== filters.itemType) {
    return false;
  }
  if (
    filters.user &&
    !item.userAddress.toLowerCase().includes(filters.user.toLowerCase())
  ) {
    return false;
  }
  if (
    filters.symbol &&
    !item.symbol?.toLowerCase().includes(filters.symbol.toLowerCase())
  ) {
    return false;
  }
  if (
    filters.side &&
    normalizedSide(item.side) !== normalizedSide(filters.side)
  ) {
    return false;
  }
  if (filters.orderType) {
    if (item.recordType !== "order") return false;
    if (
      item.orderType?.toLowerCase() !== filters.orderType.toLowerCase() &&
      item.type?.toLowerCase() !== filters.orderType.toLowerCase()
    ) {
      return false;
    }
  }
  if (
    filters.minDollarValue !== undefined &&
    Math.abs(toNumeric(item.notional)) < filters.minDollarValue
  ) {
    return false;
  }
  if (filters.timestampRange.from || filters.timestampRange.to) {
    const timestamp = timestampMs(
      item.recordType === "position" ? item.updateTime : item.timestamp,
    );
    if (!timestamp) return false;
    if (
      filters.timestampRange.from &&
      timestamp < filters.timestampRange.from
    ) {
      return false;
    }
    if (filters.timestampRange.to && timestamp > filters.timestampRange.to) {
      return false;
    }
  }
  return true;
}

function buildPositions(
  state: ReflectedState,
  deployment: PerpetualHubDeployment,
): PerpetualHubPositionRecord[] {
  const positions: PerpetualHubPositionRecord[] = [];

  for (const user of state.users ?? []) {
    const userAddress = user.user;
    if (!userAddress) continue;

    for (const [index, rawPosition] of (user.positions ?? []).entries()) {
      const rawQuantity = quantityToUnits(
        rawPosition.quantity ?? rawPosition.positionAmt,
      );
      if (!rawQuantity) continue;

      const position = scalePosition(rawPosition);
      const quantity = toNumeric(position.quantity ?? position.positionAmt);
      const entryPrice = toNumeric(position.entryPrice);
      const notional =
        position.notional ??
        (quantity && entryPrice ? Math.abs(quantity * entryPrice) : undefined);

      positions.push({
        ...position,
        recordType: "position",
        id: `${deployment.partnerId}-${deployment.chainId}-${userAddress}-${position.symbol ?? "unknown"}-${index}`,
        userAddress,
        sequenceNumber: state.sequenceNumber,
        userBalance: amountToUsd(user.balance),
        side: position.side ?? sideFromQuantity(quantity),
        quantity: position.quantity ?? position.positionAmt,
        notional,
        partnerId: deployment.partnerId,
        partnerName: deployment.partnerName,
        chainId: deployment.chainId,
        chainName: deployment.chainName,
        contractAddress: deployment.contractAddress,
        status: "OPEN",
      });
    }
  }

  return positions.sort(
    (a, b) => toNumeric(b.notional) - toNumeric(a.notional),
  );
}

function buildOrders(
  state: ReflectedState,
  deployment: PerpetualHubDeployment,
): PerpetualHubOrderRecord[] {
  const orders: PerpetualHubOrderRecord[] = [];

  for (const user of state.users ?? []) {
    const userAddress = user.user;
    if (!userAddress) continue;

    for (const [index, rawOrder] of (user.pendingOrders ?? []).entries()) {
      const quantity = maybeScaledQuantity(
        rawOrder.quantity ?? rawOrder.origQty,
      );
      const price = maybeScaledPrice(rawOrder.price);
      const stopPrice = maybeScaledPrice(rawOrder.stopPrice);
      const orderType = rawOrder.orderType ?? rawOrder.type;
      const timestamp =
        rawOrder.timestamp ?? rawOrder.updateTime ?? rawOrder.time ?? undefined;
      const notional =
        quantity && (price || stopPrice)
          ? Math.abs(quantity * (price || stopPrice || 0))
          : undefined;
      const orderId =
        rawOrder.orderId ?? rawOrder.clientOrderId ?? rawOrder.id ?? index;

      orders.push({
        ...rawOrder,
        recordType: "order",
        id: `${deployment.partnerId}-${deployment.chainId}-${userAddress}-${orderId}`,
        orderId: rawOrder.orderId ?? rawOrder.id,
        userAddress,
        sequenceNumber: state.sequenceNumber,
        quantity,
        price,
        stopPrice,
        orderType,
        timestamp,
        notional,
        partnerId: deployment.partnerId,
        partnerName: deployment.partnerName,
        chainId: deployment.chainId,
        chainName: deployment.chainName,
        contractAddress: deployment.contractAddress,
      });
    }
  }

  return orders.sort(
    (a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp),
  );
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
    itemType: searchParams.get("item_type") || undefined,
    user: searchParams.get("user") || undefined,
    symbol: searchParams.get("symbol") || undefined,
    side: searchParams.get("side") || undefined,
    orderType: searchParams.get("order_type") || undefined,
    minDollarValue: searchParams.get("min_dollar_value")
      ? Number(searchParams.get("min_dollar_value"))
      : undefined,
    timestampRange: parseTimestampRange(searchParams.get("timestamp")),
  };

  if (!deployments.length) {
    return NextResponse.json({
      items: [],
      positions: [],
      orders: [],
      total: 0,
      limit,
      offset,
      updatedAt: Date.now(),
    } satisfies PerpetualHubPositionList);
  }

  const stateResponses = await Promise.all(
    deployments.map(async (deployment) => {
      const response = await fetchJson<ReflectedState>(
        `${trimTrailingSlash(deployment.backendUrl)}/get-last-state`,
      );
      return { deployment, response };
    }),
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

  const allItems = stateResponses
    .flatMap(({ deployment, response }) => [
      ...buildPositions(response.data!, deployment),
      ...buildOrders(response.data!, deployment),
    ])
    .filter((item) =>
      positionMatches(item, {
        ...filters,
        minDollarValue: Number.isFinite(filters.minDollarValue)
          ? filters.minDollarValue
          : undefined,
      }),
    )
    .sort((a, b) => {
      const sequenceDiff = (b.sequenceNumber ?? 0) - (a.sequenceNumber ?? 0);
      if (sequenceDiff) return sequenceDiff;
      const timestampDiff =
        timestampMs(b.recordType === "position" ? b.updateTime : b.timestamp) -
        timestampMs(a.recordType === "position" ? a.updateTime : a.timestamp);
      if (timestampDiff) return timestampDiff;
      return toNumeric(b.notional) - toNumeric(a.notional);
    });
  const pageItems = allItems.slice(offset, offset + limit);

  const payload: PerpetualHubPositionList = {
    items: pageItems,
    positions: pageItems.filter(
      (item): item is PerpetualHubPositionRecord =>
        item.recordType === "position",
    ),
    orders: pageItems.filter(
      (item): item is PerpetualHubOrderRecord => item.recordType === "order",
    ),
    total: allItems.length,
    limit,
    offset,
    sequenceNumber: Math.max(
      0,
      ...stateResponses.map((item) => item.response.data?.sequenceNumber ?? 0),
    ),
    updatedAt: Date.now(),
  };

  return NextResponse.json(payload);
}
