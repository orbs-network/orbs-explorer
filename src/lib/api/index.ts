import axios from "axios";
import _, { flatten } from "lodash";
import { ListOrder, Order } from "../types";
import { queryInitialData } from "../liquidity-hub/elastic-queries/main";
import { TWAP_ELASTIC_CLIENT_URL } from "../consts";

type Filters = {
  account?: string;
  chainIds?: number[];
  hash?: string;
  status?: string;
  exchange?: string;
};

const SINK_API_URL = "https://order-sink.orbs.network";
// const SINK_API_URL = "https://order-sink-dev.orbs.network";

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
}: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters: Filters;
}) => {
  const callback = async (chainId?: number): Promise<ListOrder[]> => {
    const filtersQuery = handleFilters(filters);

    const response = await axios.get(
      `
    ${SINK_API_URL}/orders?view=list&page=${page}&limit=${limit}${filtersQuery}`,
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
}: {
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters: Filters;
}): Promise<ListOrder[]> => {
  try {
    const orders = await getOrders({
      signal,
      page,
      limit,
      filters,
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
}: {
  signal?: AbortSignal;
  hash: string;
}): Promise<Order | undefined> => {

  const getOrder = async (url: string) => {
    const response = await axios.get(
      `${url}/orders?hash=${hash}`,
      {
        signal,
      },
    );
    return response.data.orders[0] as Order;
  };

  const response = await getOrder(SINK_API_URL);

  return response;
};

export const getSpotConfig = async () => {
  const res = await axios.get(
    "https://raw.githubusercontent.com/orbs-network/spot/master/script/input/config.json",
  );
  return res.data;
};

export const getTokenLogo = async (address: string, chainId: number) => {
  const response = await axios.get(
    `https://api.coingecko.com/api/v3/coins/${chainId}/contract/${address}`,
    {
      method: "GET",
    },
  );
  return response.data.image.small;
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