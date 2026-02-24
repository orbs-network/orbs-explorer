import axios from "axios";
import _, { flatten } from "lodash";
import { ListOrder, Order, SpotConfig } from "../types";
import { queryInitialData } from "../liquidity-hub/elastic-queries/main";
import { TWAP_ELASTIC_CLIENT_URL } from "../consts";

type Filters = {
  account?: string;
  chainIds?: number[];
  hash?: string;
  status?: string;
  exchange?: string;
};

export const SINK_API_URLS = {
  prod: "https://order-sink.orbs.network",
  dev: "https://order-sink-dev.orbs.network",
} as const;

const SINK_API_URL = SINK_API_URLS.prod;

const handleFilters = (filters: Filters) => {
  const chainQuery = filters.chainIds
    ? `&chainId=${filters.chainIds.join(",")}`
    : "";
  const swapper = filters.account ? `&swapper=${filters.account}` : "";
  const hash = filters.hash ? `&hash=${filters.hash}` : "";
  const status = filters.status ? `&status=${filters.status}` : "";
  const exchange = filters.exchange ? `&exchange=${filters.exchange}` : "";
  return `${chainQuery}${swapper}${hash}${status}${exchange}`;
};

const getOrders = async ({
  signal,
  page,
  limit,
  filters,
  baseUrl = SINK_API_URL,
}: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters: Filters;
  baseUrl?: string;
}) => {
  const callback = async (): Promise<ListOrder[]> => {
    const filtersQuery = handleFilters(filters);

    const response = await axios.get(
      `${baseUrl}/orders?view=list&page=${page}&limit=${limit}${filtersQuery}`,
      {
        signal,
      },
    );

    const orders = response.data.orders;
    return orders as ListOrder[];
  };

  if (filters.chainIds) {
    const results = await Promise.allSettled(filters.chainIds.map(callback));
    const res = results.map((result) =>
      result.status === "fulfilled" ? result.value : null,
    );
    return flatten(res).filter(Boolean) as ListOrder[];
  }

  return callback();
};

export type OrdersPageResponse = {
  orders: ListOrder[];
  total: number;
};

export const getOrdersPageWithFilters = async ({
  signal,
  page = 0,
  limit = 400,
  filters,
}: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters: Filters;
}): Promise<OrdersPageResponse> => {
  const filtersQuery = handleFilters(filters);
  const response = await axios.get(
    `${SINK_API_URL}/orders?view=list&page=${page}&limit=${limit}${filtersQuery}`,
    { signal }
  );
  const orders = (response.data.orders ?? []) as ListOrder[];
  const total = orders.length;
  return { orders, total };
};

/**
 * Fetches all orders for a given exchange adapter with pagination.
 * Uses the `exchange` filter param (adapter address).
 */
export const getAllOrdersForExchange = async ({
  exchange: adapter,
  signal,
  limit = 400,
}: {
  exchange: string;
  signal?: AbortSignal;
  limit?: number;
}): Promise<ListOrder[]> => {
  const all: ListOrder[] = [];
  let page = 0;
  let totalFetched = 0;
  let totalFromApi: number | null = null;

  while (true) {
    const { orders, total } = await getOrdersPageWithFilters({
      signal,
      page,
      limit,
      filters: { exchange: adapter },
    });

    if (totalFromApi === null) totalFromApi = total;
    all.push(...orders);
    totalFetched += orders.length;

    if (orders.length < limit || (totalFromApi !== null && totalFetched >= totalFromApi)) {
      break;
    }
    page += 1;
  }

  return all.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

/**
 * Fetches all orders for a given exchange adapter on a specific chain.
 */
export const getAllOrdersForExchangeAndChain = async ({
  exchange: adapter,
  chainId,
  signal,
  limit = 400,
}: {
  exchange: string;
  chainId: number;
  signal?: AbortSignal;
  limit?: number;
}): Promise<ListOrder[]> => {
  const all: ListOrder[] = [];
  let page = 0;
  let totalFetched = 0;
  let totalFromApi: number | null = null;

  while (true) {
    const { orders, total } = await getOrdersPageWithFilters({
      signal,
      page,
      limit,
      filters: { exchange: adapter, chainIds: [chainId] },
    });

    if (totalFromApi === null) totalFromApi = total;
    all.push(...orders);
    totalFetched += orders.length;

    if (
      orders.length < limit ||
      (totalFromApi !== null && totalFetched >= totalFromApi)
    ) {
      break;
    }
    page += 1;
  }

  return all.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

export const getOrdersListPage = async ({
  signal,
  page = 0,
  limit = 400,
}: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
}): Promise<{ orders: ListOrder[]; total?: number }> => {
  const response = await axios.get(
    `${SINK_API_URL}/orders?view=list&page=${page}&limit=${limit}`,
    { signal }
  );
  return {
    orders: (response.data.orders ?? []) as ListOrder[],
    total: response.data.total,
  };
};

export const getSpotOrders = async ({
  signal,
  page,
  limit = 3_00,
  filters,
  sinkApiUrl,
}: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters: Filters;
  sinkApiUrl?: string;
}): Promise<ListOrder[]> => {
  try {
    const orders = await getOrders({
      signal,
      page,
      limit,
      filters,
      baseUrl: sinkApiUrl ?? SINK_API_URL,
    });

    return orders.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const getSpotOrder = async ({
  signal,
  hash,
  sinkApiUrl,
}: {
  signal?: AbortSignal;
  hash: string;
  sinkApiUrl?: string;
}): Promise<Order | undefined> => {
  
  const url = sinkApiUrl ?? SINK_API_URL;
  const response = await axios.get(`${url}/orders?hash=${hash}`, { signal });
  return response.data.orders[0] as Order;
};

export const getSpotConfig = async (): Promise<SpotConfig> => {
  const res = await axios.get(
    "https://raw.githubusercontent.com/orbs-network/spot/master/script/input/config.json",
  );
  return res.data;
};


export const normalizeSessions = (sessions: any[]) => {
  return _.map(sessions, (session) => {
    return _.mapValues(session, (value) => {
      if (Array.isArray(value) && _.size(value) === 1) {
        value = _.first(value);
      }

      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      } else {
        return value;
      }
    });
  });
};

export const fetchElastic = async <T>(
  url: string,
  data: any,
  signal?: AbortSignal,
): Promise<T[]> => {
  const response = await axios.post(`${url}/_search`, { ...data }, { signal });

  return normalizeSessions(
    response.data.hits?.hits.map((hit: any) => hit.fields),
  );
};



export const getOrderLogs = (hash: string) => {
  return {
    ...queryInitialData,
    query: {
      bool: {
        filter: [
          {
            bool: {
              should: [
                { term: { "orderHash.keyword": hash } },

              ],
              minimum_should_match: 1, // ensures at least one condition must match
            },
          },
        ],
      },
    },
    sort: [
      {
        timestamp: {
          order: "desc",
        },
      },
    ],
  };
};


export const getOrderLogsUI = async (hash: string, signal?: AbortSignal) => {
  const response = await fetchElastic<any>(
    TWAP_ELASTIC_CLIENT_URL,
    getOrderLogs(hash),
    signal,
  );
  return normalizeSessions(response);
};