import axios from "axios";
import _, { flatten } from "lodash";
import { ListOrder, Order } from "../types";

type Filters = {
  account?: string;
  chainIds?: number[];
  hash?: string;
};

const SINK_PROD_URL = "https://order-sink.orbs.network";
const SINK_DEV_URL = "https://order-sink-dev.orbs.network";

const handleFilters = (filters: Filters) => {
  const chainQuery = filters.chainIds
    ? `&chainId=${filters.chainIds.join(",")}`
    : "";
  const swapper = filters.account ? `&swapper=${filters.account}` : "";
  const hash = filters.hash ? `&hash=${filters.hash}` : "";
  return `${chainQuery}${swapper}${hash}`;
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
    ${SINK_DEV_URL}/orders?view=list&page=${page}&limit=${limit}${filtersQuery}`,
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

  const [devResponse, prodResponse] = await Promise.all([
    getOrder(SINK_DEV_URL),
    getOrder(SINK_PROD_URL),
  ]);

  return devResponse ?? prodResponse;
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
