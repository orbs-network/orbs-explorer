import axios from "axios";
import type { ListOrder, Order, SpotConfig } from "./types";
import {
  fetchElastic,
  normalizeSessions,
  queryInitialData,
} from "../api/fetch-elastic";
import { TWAP_ELASTIC_CLIENT_URL } from "../consts";
import {
  mergeSpotPartnerCatalogs,
  parseSpotConfig,
  parseSpotPartnerCatalog,
} from "./partner-catalog";

export const SINK_API_URLS = {
  prod: "https://order-sink.orbs.network",
  dev: "https://order-sink-dev.orbs.network",
} as const;
export const CURRENT_SINK_API_URL = "https://order-sink-v2.orbs.network";
export const SPOT_CONFIG_URL =
  "https://raw.githubusercontent.com/orbs-network/spot/master/config.json";

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
  source?: "v1" | "v2",
): Promise<ListOrder[]> {
  signal?.throwIfAborted();
  const results = await Promise.allSettled(
    (source
      ? [source === "v2" ? CURRENT_SINK_API_URL : SINK_API_URLS.prod]
      : endpoints()
    ).map(async (endpoint) => {
      const orders = await fetchOrders<ListOrder>(
        endpoint,
        orderQuery(filters, 0, limit),
        signal,
      );
      if (orders.length < limit) return orders;

      // Both services return empty lists beyond the tail. Bound parallel work
      // per source, and consume pages in request order so duplicate precedence
      // never depends on network timing. A short page ends that source only.
      const concurrency = 3;
      for (let page = 1; ; page += concurrency) {
        signal?.throwIfAborted();
        const batches = await Promise.all(
          Array.from({ length: concurrency }, (_, offset) =>
            fetchOrders<ListOrder>(
              endpoint,
              orderQuery(filters, page + offset, limit),
              signal,
            ),
          ),
        );
        signal?.throwIfAborted();
        for (const batch of batches) {
          orders.push(...batch);
          if (batch.length < limit) return orders;
        }
      }
    }),
  );
  // Overview totals must be complete: never silently present partial totals.
  signal?.throwIfAborted();
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
  return deduplicateOrders(successfulResults(results, signal).flat());
}

export type SpotOrderHistoryScope = {
  fromTimestamp?: number;
  untilTimestamp?: number;
  chainIds?: number[];
  exchange?: string;
  swapper?: string;
  source?: "v1" | "v2";
};

/** Both services page newest first. Stop at the requested placement boundary;
 * never send unsupported date parameters or expose an incomplete scoped total.
 */
export async function getSpotOrdersForScope({
  signal,
  limit = 100,
  ...scope
}: SpotOrderHistoryScope & { signal?: AbortSignal; limit?: number }): Promise<
  ListOrder[]
> {
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error("Invalid order page size");
  for (const boundary of [scope.fromTimestamp, scope.untilTimestamp])
    if (boundary !== undefined && !Number.isFinite(boundary))
      throw new Error("Invalid order placement range");
  if (
    scope.fromTimestamp !== undefined &&
    scope.untilTimestamp !== undefined &&
    scope.fromTimestamp > scope.untilTimestamp
  )
    return [];
  const filters: Filters = {
    chainIds: scope.chainIds,
    exchange: scope.exchange,
    account: scope.swapper,
  };
  if (scope.fromTimestamp === undefined && scope.untilTimestamp === undefined)
    return fetchAllOrders(filters, signal, 400, scope.source);
  const sources = scope.source
    ? [scope.source === "v2" ? CURRENT_SINK_API_URL : SINK_API_URLS.prod]
    : endpoints();
  const results = await Promise.allSettled(
    sources.map(async (endpoint) => {
      const orders: ListOrder[] = [];
      let previousTime = Infinity;
      let ordered = true;
      for (let page = 0; ; page++) {
        signal?.throwIfAborted();
        const batch = await fetchOrders<ListOrder>(
          endpoint,
          orderQuery(filters, page, limit),
          signal,
        );
        signal?.throwIfAborted();
        for (const order of batch) {
          const time = Date.parse(order.timestamp);
          // If a source violates its ordering, keep paging rather than silently
          // treating the remaining history as outside the requested range.
          if (!Number.isFinite(time) || time > previousTime) ordered = false;
          previousTime = time;
          if (
            Number.isFinite(time) &&
            (scope.fromTimestamp === undefined ||
              time >= scope.fromTimestamp) &&
            (scope.untilTimestamp === undefined || time <= scope.untilTimestamp)
          )
            orders.push(order);
        }
        if (
          batch.length < limit ||
          (ordered &&
            scope.fromTimestamp !== undefined &&
            previousTime < scope.fromTimestamp)
        )
          return orders;
      }
    }),
  );
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

/** The list view omits wallet addresses; use the services' exact swapper filter. */
export const getAllOrdersForSwapper = ({
  swapper,
  signal,
  limit,
}: {
  swapper: string;
  signal?: AbortSignal;
  limit?: number;
}): Promise<ListOrder[]> => fetchAllOrders({ account: swapper }, signal, limit);

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
  requestStatus?: (endpoint: string) => Promise<unknown>,
): Promise<SpotConfig> => {
  signal?.throwIfAborted();
  const request = async (url: string): Promise<unknown> =>
    (await axios.get<unknown>(url, { signal, timeout: 20_000 })).data;
  const [configResult, ...catalogResults] = await Promise.allSettled([
    request(SPOT_CONFIG_URL).then(parseSpotConfig),
    ...endpoints().map((endpoint) =>
      (requestStatus
        ? requestStatus(endpoint)
        : request(`${endpoint}/status`)
      ).then(parseSpotPartnerCatalog),
    ),
  ] as const);
  signal?.throwIfAborted();
  const catalogs = catalogResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  if (configResult.status === "rejected" && !catalogs.length)
    throw configResult.reason;
  return mergeSpotPartnerCatalogs(
    configResult.status === "fulfilled" ? configResult.value : null,
    catalogs,
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
