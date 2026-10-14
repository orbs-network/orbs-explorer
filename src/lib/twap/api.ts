import axios from "axios";
import type { ListOrder, Order, SpotConfig } from "./types";
import {
  fetchElastic,
  normalizeSessions,
  queryInitialData,
} from "../api/fetch-elastic";
import { TWAP_ELASTIC_CLIENT_URL } from "../consts";

export const SINK_API_URLS = {
  prod: "https://order-sink.orbs.network",
  dev: "https://order-sink-dev.orbs.network",
} as const;
export const CURRENT_SINK_API_URL = "https://order-sink-v2.orbs.network";

type Filters = {
  account?: string | string[];
  chainIds?: number[];
  hash?: string;
  status?: string;
  exchange?: string;
};

function endpoints(baseUrl?: string): string[] {
  return !baseUrl || baseUrl === SINK_API_URLS.prod
    ? [CURRENT_SINK_API_URL, SINK_API_URLS.prod]
    : [baseUrl];
}

function orderQuery(
  filters: Filters,
  page?: number,
  limit?: number,
  list = true,
) {
  const query = new URLSearchParams();
  if (list) query.set("view", "list");
  // UI pages are zero-based; both order services treat 0 and 1 as the first page.
  if (page !== undefined) query.set("page", String(page + 1));
  if (limit !== undefined) query.set("limit", String(limit));
  if (filters.chainIds?.length)
    query.set("chainId", filters.chainIds.join(","));
  const accounts = Array.isArray(filters.account)
    ? filters.account
    : filters.account
      ? [filters.account]
      : [];
  if (accounts.length) query.set("swapper", accounts.join(","));
  if (filters.hash) query.set("hash", filters.hash);
  if (filters.status) query.set("status", filters.status);
  if (filters.exchange) query.set("exchange", filters.exchange);
  return query;
}

async function fetchOrders<T>(
  endpoint: string,
  query: URLSearchParams,
  signal?: AbortSignal,
): Promise<T[]> {
  const response = await axios.get(`${endpoint}/orders?${query}`, {
    signal,
    timeout: 20_000,
  });
  if (!Array.isArray(response.data?.orders))
    throw new Error("Invalid order history response");
  return response.data.orders.map((order: T) => ({
    ...order,
    source: endpoint === CURRENT_SINK_API_URL ? "v2" : "v1",
  }));
}

function successfulResults<T>(
  results: PromiseSettledResult<T>[],
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const successful = results.filter(
    (result): result is PromiseFulfilledResult<T> =>
      result.status === "fulfilled",
  );
  if (!successful.length) {
    const failure = results.find((result) => result.status === "rejected");
    throw failure?.reason ?? new Error("Order history unavailable");
  }
  return successful.map((result) => result.value);
}

function deduplicateOrders(orders: ListOrder[]): ListOrder[] {
  const byKey = new Map<string, ListOrder>();
  for (const order of orders) {
    const chainId = order.order.witness.chainId ?? order.order.witness.chainid;
    const key = `${chainId}:${order.hash.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, order);
  }
  return [...byKey.values()].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
}

export type OrdersPageResponse = {
  orders: ListOrder[];
  hasMore: boolean;
  warnings: string[];
};

export const getSpotOrdersPage = async ({
  signal,
  page = 0,
  limit = 400,
  filters,
  sinkApiUrl,
}: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters: Filters;
  sinkApiUrl?: string;
}): Promise<OrdersPageResponse> => {
  const sources = endpoints(sinkApiUrl);
  const results = await Promise.allSettled(
    sources.map((endpoint) =>
      fetchOrders<ListOrder>(
        endpoint,
        orderQuery(filters, page, limit),
        signal,
      ),
    ),
  );
  const pages = successfulResults(results, signal);
  return {
    orders: deduplicateOrders(pages.flat()),
    hasMore: pages.some((orders) => orders.length >= limit),
    warnings: results.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            `${sources[index] === CURRENT_SINK_API_URL ? "Current" : "Original"} order history is unavailable. Showing available orders.`,
          ]
        : [],
    ),
  };
};

export const getSpotOrders = async (
  params: Parameters<typeof getSpotOrdersPage>[0],
): Promise<ListOrder[]> => (await getSpotOrdersPage(params)).orders;

export const getOrdersPageWithFilters = getSpotOrdersPage;

async function fetchAllOrders(
  filters: Filters,
  signal?: AbortSignal,
  limit = 400,
): Promise<ListOrder[]> {
  const results = await Promise.allSettled(
    endpoints().map(async (endpoint) => {
      const orders: ListOrder[] = [];
      for (let page = 0; ; page++) {
        const batch = await fetchOrders<ListOrder>(
          endpoint,
          orderQuery(filters, page, limit),
          signal,
        );
        orders.push(...batch);
        if (batch.length < limit) break;
      }
      return orders;
    }),
  );
  // Overview totals must be complete: never silently present partial totals.
  signal?.throwIfAborted();
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
  return deduplicateOrders(successfulResults(results, signal).flat());
}

export const getAllOrdersForExchange = ({
  exchange,
  signal,
  limit,
}: {
  exchange: string;
  signal?: AbortSignal;
  limit?: number;
}): Promise<ListOrder[]> => fetchAllOrders({ exchange }, signal, limit);

export const getAllOrdersForExchangeAndChain = ({
  exchange,
  chainId,
  signal,
  limit,
}: {
  exchange: string;
  chainId: number;
  signal?: AbortSignal;
  limit?: number;
}): Promise<ListOrder[]> =>
  fetchAllOrders({ exchange, chainIds: [chainId] }, signal, limit);

export const getOrdersListPage = (params: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
}): Promise<OrdersPageResponse> =>
  getSpotOrdersPage({ ...params, filters: {} });

export const getSpotOrder = async ({
  signal,
  hash,
  sinkApiUrl,
  source,
}: {
  signal?: AbortSignal;
  hash: string;
  sinkApiUrl?: string;
  source?: string;
}): Promise<Order | undefined> => {
  const sources =
    source === "v1" && (!sinkApiUrl || sinkApiUrl === SINK_API_URLS.prod)
      ? [SINK_API_URLS.prod]
      : source === "v2"
        ? [CURRENT_SINK_API_URL]
        : endpoints(sinkApiUrl);
  const results = await Promise.allSettled(
    sources.map((endpoint) =>
      fetchOrders<Order>(
        endpoint,
        orderQuery({ hash }, undefined, undefined, false),
        signal,
      ),
    ),
  );
  const order = successfulResults(results, signal).flat()[0];
  // A failed source cannot confirm that the order does not exist.
  if (!order && results.some((result) => result.status === "rejected")) {
    throw new Error("Some order history is unavailable. Try again.");
  }
  return order;
};

export const getSpotConfig = async (
  signal?: AbortSignal,
): Promise<SpotConfig> => {
  const res = await axios.get(
    "https://raw.githubusercontent.com/orbs-network/spot/master/config.json",
    { signal },
  );
  const config = res.data as SpotConfig;
  const sharedDexes = config["*"]?.dex;
  return Object.fromEntries(
    Object.entries(config).map(([chainId, chain]) => [
      chainId,
      chainId === "*"
        ? chain
        : { ...chain, dex: { ...sharedDexes, ...chain.dex } },
    ]),
  );
};

const getOrderLogs = (hash: string) => ({
  ...queryInitialData,
  query: {
    bool: {
      filter: [
        {
          bool: {
            should: [{ term: { "orderHash.keyword": hash } }],
            minimum_should_match: 1,
          },
        },
      ],
    },
  },
  sort: [{ timestamp: { order: "desc" as const } }],
});

export const getOrderLogsUI = async (hash: string, signal?: AbortSignal) => {
  const response = await fetchElastic<unknown>(
    TWAP_ELASTIC_CLIENT_URL,
    getOrderLogs(hash),
    signal,
  );
  return normalizeSessions(response);
};
