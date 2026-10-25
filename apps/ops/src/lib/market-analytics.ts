import type { ListOrder } from "@orbs/domain/twap/types";
import type { Token } from "@orbs/domain/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  getOverviewOrderStatus,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { hasExecutionErrors, reportedNumber } from "./order-diagnostics";

/** Linear interpolation over reported, nonnegative values. */
export function percentile(sorted: number[], fraction: number) {
  if (!sorted.length) return undefined;
  const index = Math.min(1, Math.max(0, fraction)) * (sorted.length - 1);
  const lower = Math.floor(index);
  return (
    sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
  );
}

export function summarizeCohort(orders: ListOrder[]) {
  const outcomes: Record<OverviewOrderStatus, ListOrder[]> = {
    completed: [],
    partial: [],
    active: [],
    cancelled: [],
    expired: [],
    failed: [],
    unknown: [],
  };
  const values: number[] = [];
  const withErrors: ListOrder[] = [];
  const unpriced: ListOrder[] = [];
  let value = 0;
  for (const order of orders) {
    outcomes[getOverviewOrderStatus(order)].push(order);
    if (hasExecutionErrors(order)) withErrors.push(order);
    const reported = reportedNumber(order.totalUSDAmount);
    if (reported === undefined) unpriced.push(order);
    else {
      values.push(reported);
      value += reported;
    }
  }
  values.sort((a, b) => a - b);
  return {
    orders,
    outcomes,
    withErrors,
    unpriced,
    value,
    pricedCount: values.length,
    mean: values.length ? value / values.length : undefined,
    median: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    maximum: values.at(-1),
  };
}

export type CohortSummary = ReturnType<typeof summarizeCohort>;
export type MarketToken = { chainId: number; address: string; token?: Token };
export type MarketRoute = {
  key: string;
  chainId: number;
  input: MarketToken;
  output: MarketToken;
  summary: CohortSummary;
};
export type TokenActivity = MarketToken & {
  key: string;
  summary: CohortSummary;
  input: CohortSummary;
  output: CohortSummary;
};

function enrichToken(current: Token | undefined, next: Token | undefined) {
  if (!next) return current;
  if (!current) return next;
  return {
    ...current,
    symbol: current.symbol || next.symbol,
    name: current.name || next.name,
    logoUrl: current.logoUrl || next.logoUrl,
  };
}

export function buildMarketAnalytics(
  orders: ListOrder[],
  resolveToken?: (address: string, chainId: number) => Token | undefined,
) {
  const routes = new Map<
    string,
    {
      key: string;
      chainId: number;
      input: MarketToken;
      output: MarketToken;
      orders: ListOrder[];
    }
  >();
  const tokens = new Map<
    string,
    MarketToken & {
      key: string;
      orders: ListOrder[];
      inputOrders: ListOrder[];
      outputOrders: ListOrder[];
    }
  >();
  for (const order of orders) {
    const chainId = getTwapOrderChainId(order) ?? 0;
    const inputAddress =
      order.inputToken?.trim().toLowerCase() || "not-provided";
    const outputAddress =
      order.outputToken?.trim().toLowerCase() || "not-provided";
    const input = {
      chainId,
      address: inputAddress,
      token: enrichToken(
        order.metadata.srcToken,
        resolveToken?.(inputAddress, chainId),
      ),
    };
    const output = {
      chainId,
      address: outputAddress,
      token: enrichToken(
        order.metadata.dstToken,
        resolveToken?.(outputAddress, chainId),
      ),
    };
    const key = `${chainId}:${inputAddress}:${outputAddress}`;
    const route = routes.get(key) ?? {
      key,
      chainId,
      input,
      output,
      orders: [],
    };
    route.input.token = enrichToken(route.input.token, input.token);
    route.output.token = enrichToken(route.output.token, output.token);
    route.orders.push(order);
    routes.set(key, route);
    for (const [side, reference] of [
      ["input", input],
      ["output", output],
    ] as const) {
      const tokenKey = `${chainId}:${reference.address}`;
      const token = tokens.get(tokenKey) ?? {
        ...reference,
        key: tokenKey,
        orders: [],
        inputOrders: [],
        outputOrders: [],
      };
      token.token = enrichToken(token.token, reference.token);
      // A same-token order participates on both sides, but is one involved order.
      if (side === "input" || inputAddress !== outputAddress)
        token.orders.push(order);
      if (side === "input") token.inputOrders.push(order);
      else token.outputOrders.push(order);
      tokens.set(tokenKey, token);
    }
  }
  const compare = (
    a: { summary: CohortSummary; key: string },
    b: { summary: CohortSummary; key: string },
  ) =>
    b.summary.value - a.summary.value ||
    b.summary.orders.length - a.summary.orders.length ||
    a.key.localeCompare(b.key);
  const rankedRoutes: MarketRoute[] = [...routes.values()]
    .map(({ orders: group, ...route }) => ({
      ...route,
      summary: summarizeCohort(group),
    }))
    .sort(compare);
  const rankedTokens: TokenActivity[] = [...tokens.values()]
    .map(({ orders: group, inputOrders, outputOrders, ...token }) => ({
      ...token,
      summary: summarizeCohort(group),
      input: summarizeCohort(inputOrders),
      output: summarizeCohort(outputOrders),
    }))
    .sort(compare);
  return {
    routes: rankedRoutes,
    tokens: rankedTokens,
    summary: summarizeCohort(orders),
    sizes: buildOrderSizeDistribution(orders),
  };
}

export function buildOrderSizeDistribution(orders: ListOrder[]) {
  const sizes = [
    { key: "zero", label: "$0 reported", min: 0, max: 0 },
    { key: "under-10", label: "Under $10", min: 0, max: 10 },
    { key: "10-100", label: "$10–$100", min: 10, max: 100 },
    { key: "100-1k", label: "$100–$1K", min: 100, max: 1_000 },
    { key: "1k-10k", label: "$1K–$10K", min: 1_000, max: 10_000 },
    { key: "over-10k", label: "$10K or more", min: 10_000, max: Infinity },
  ].map((bucket) => ({ ...bucket, orders: [] as ListOrder[] }));
  const unpriced: ListOrder[] = [];
  for (const order of orders) {
    const value = reportedNumber(order.totalUSDAmount);
    if (value === undefined) unpriced.push(order);
    else if (value === 0) sizes[0].orders.push(order);
    else
      sizes
        .find((bucket) => value >= bucket.min && value < bucket.max)
        ?.orders.push(order);
  }
  return [
    ...sizes.map((bucket) => ({
      ...bucket,
      summary: summarizeCohort(bucket.orders),
    })),
    {
      key: "unpriced",
      label: "Value not reported",
      min: NaN,
      max: NaN,
      orders: unpriced,
      summary: summarizeCohort(unpriced),
    },
  ];
}

export function buildCategoricalCohorts(
  orders: ListOrder[],
  field: "source" | "type",
) {
  const groups = new Map<string, ListOrder[]>();
  for (const order of orders) {
    const label =
      field === "source"
        ? (order.source ?? "Source not provided")
        : order.metadata.orderType?.trim() || "Type not provided";
    const group = groups.get(label) ?? [];
    group.push(order);
    groups.set(label, group);
  }
  return [...groups].map(([label, group]) => ({
    key: label,
    label,
    orders: group,
  }));
}

export const UTC_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function buildPlacementHeatmap(orders: ListOrder[], snapshot: number) {
  const cells = Array.from({ length: 168 }, (_, index) => ({
    day: Math.floor(index / 24),
    hour: index % 24,
    orders: [] as ListOrder[],
    value: 0,
  }));
  const excluded: ListOrder[] = [];
  for (const order of orders) {
    const time = Date.parse(order.timestamp);
    if (!Number.isFinite(time) || time <= 0 || time > snapshot) {
      excluded.push(order);
      continue;
    }
    const date = new Date(time);
    const day = (date.getUTCDay() + 6) % 7;
    const cell = cells[day * 24 + date.getUTCHours()];
    cell.orders.push(order);
    cell.value += reportedNumber(order.totalUSDAmount) ?? 0;
  }
  return {
    cells,
    excluded,
    maximum: cells.reduce((max, cell) => Math.max(max, cell.orders.length), 0),
    included: orders.length - excluded.length,
  };
}
