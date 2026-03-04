/**
 * Old TWAP (v1) API – fetches orders from The Graph subgraph.
 * Adapted from spot-ui v1-orders.ts.
 */

import BN from "bignumber.js";
import {
  THE_GRAPH_ORDERS_API,
} from "../consts";
import type {
  OrderV1,
  FillV1,
  OrderFill,
  TwapV1OrderParsed,
  TwapV1OrderDisplay,
  GetV1OrdersFilters,
  RawStatus,
} from "./v1-types";
import {
  TwapV1OrderStatus as V1Status,
  TwapV1OrderType as V1Type,
} from "./v1-types";

type GraphQLPageFetcher = (page: number, limit: number) => string;

function getTheGraphUrl(chainId?: number): string | undefined {
  if (!chainId) return undefined;
  return THE_GRAPH_ORDERS_API[chainId];
}

function eqIgnoreCase(a?: string, b?: string): boolean {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

function uniq<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

function normalizeSubgraphList<T>(
  list?: T[],
  transform?: (val: T) => string
): string[] | undefined {
  return list?.length
    ? list.map(transform ?? ((v) => `${v}`))
    : undefined;
}

const fetchWithRetryPaginated = async <T>({
  chainId,
  buildQuery,
  extractResults,
  signal,
  retries = 1,
  limit = 5000,
  page: _page,
}: {
  chainId: number;
  buildQuery: GraphQLPageFetcher;
  extractResults: (response: unknown) => T[];
  signal?: AbortSignal;
  retries?: number;
  limit?: number;
  page?: number;
}): Promise<T[]> => {
  const endpoint = getTheGraphUrl(chainId);
  if (!endpoint) throw new NoGraphEndpointError();

  const fetchPage = async (query: string): Promise<T[]> => {
    let attempts = 0;
    while (attempts <= retries) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          body: JSON.stringify({ query }),
          signal,
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0]?.message ?? "Graph error");
        const results = extractResults(json);
        console.log("results", results);
        return results;
      } catch (err) {
        if (attempts === retries) throw err;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempts));
        attempts++;
      }
    }
    return [];
  };

  let page = 0;
  const results: T[] = [];

  if (_page !== undefined) {
    const query = buildQuery(_page, limit);
    try {
      return await fetchPage(query);
    } catch {
      try {
        return await fetchPage(query);
      } catch {
        return [];
      }
    }
  }

  while (true) {
    const query = buildQuery(page, limit);
    let pageResults: T[];
    try {
      pageResults = await fetchPage(query);
    } catch {
      try {
        pageResults = await fetchPage(query);
      } catch {
        return results;
      }
    }
    results.push(...pageResults);
    if (pageResults.length < limit) break;
    page++;
  }
  return results;
};

function parseFills(fills: FillV1[]): OrderFill[] {
  return fills.map((fill) => ({
    inAmount: fill.srcAmountIn,
    outAmount: fill.dstAmountOut,
    timestamp: fill.timestamp,
    txHash: fill.transactionHash,
  }));
}

function getOrderType(ask_dstMinAmount: string, chunks: number): V1Type {
  const isLimit = BN(ask_dstMinAmount || "0").gt(1);
  if (!isLimit && chunks === 1) return V1Type.TWAP_MARKET;
  if (chunks > 1 && isLimit) return V1Type.TWAP_LIMIT;
  if (isLimit) return V1Type.LIMIT;
  return V1Type.TWAP_MARKET;
}

export function getV1OrderProgress(
  srcAmount: string,
  filledSrcAmount: string
): number {
  if (!filledSrcAmount || !srcAmount) return 0;
  const progress = BN(filledSrcAmount).dividedBy(srcAmount).toNumber();
  if (progress >= 0.99) return 100;
  if (progress <= 0) return 0;
  return Number((progress * 100).toFixed(2));
}

function parseOrderStatus(
  progress: number,
  deadline: number,
  status?: RawStatus
): V1Status {
  if (progress === 100) return V1Status.Completed;
  if (status === "CANCELED") return V1Status.Canceled;
  if (status === "COMPLETED") return V1Status.Completed;
  if (deadline > Date.now()) return V1Status.Open;
  return V1Status.Expired;
}

type GraphStatus = {
  twapId: string;
  twapAddress: string;
  status: RawStatus;
};

function getStatus(
  order: OrderV1,
  fills: FillV1[],
  statuses?: GraphStatus[]
): V1Status {
  const status = statuses?.find(
    (it) =>
      it.twapId === order.Contract_id.toString() &&
      eqIgnoreCase(it.twapAddress, order.twapAddress)
  )?.status;
  const parsedFills = parseFills(fills);
  const filledSrcAmount = parsedFills
    .reduce((acc, fill) => acc.plus(fill.inAmount), new BN(0))
    .toFixed();
  const progress = getV1OrderProgress(order.ask_srcAmount, filledSrcAmount);
  return parseOrderStatus(progress, Number(order.ask_deadline) * 1000, status);
}

function buildV1Order(
  order: OrderV1,
  chainId: number,
  fills: FillV1[],
  status: V1Status
): TwapV1OrderParsed {
  const parsedFills = parseFills(fills ?? []);
  const chunks = BN(order.ask_srcAmount || "0")
    .div(order.ask_srcBidAmount || 1)
    .integerValue(BN.ROUND_FLOOR)
    .toNumber();
  const filledSrcAmount = parsedFills
    .reduce((acc, fill) => acc.plus(fill.inAmount), new BN(0))
    .toFixed();
  const filledDstAmount = parsedFills
    .reduce((acc, fill) => acc.plus(fill.outAmount), new BN(0))
    .toFixed();
  const progress = getV1OrderProgress(order.ask_srcAmount, filledSrcAmount);
  const type = getOrderType(order.ask_dstMinAmount, chunks);
  const isFilled = fills?.length === chunks;
  const filledOrderTimestamp = isFilled
    ? fills?.[fills.length - 1]?.timestamp
    : 0;

  return {
    version: 1,
    id: order.Contract_id.toString(),
    hash: order.transactionHash,
    type,
    srcTokenAddress: order.ask_srcToken,
    dstTokenAddress: order.ask_dstToken,
    exchangeAddress: order.exchange,
    twapAddress: order.twapAddress,
    maker: order.maker,
    progress,
    dstAmountFilled: filledDstAmount,
    srcAmountFilled: filledSrcAmount,
    orderDollarValueIn: BN(order.dollarValueIn || "0").gt(0) ? BN(order.dollarValueOut || "0").toFixed(6) : "0",
    srcAmount: order.ask_srcAmount,
    dstMinAmountTotal: BN(order.ask_dstMinAmount)
      .multipliedBy(chunks)
      .toString(),
    fills: parsedFills,
    fillDelay: order.ask_fillDelay,
    deadline: Number(order.ask_deadline) * 1000,
    createdAt: new Date(order.timestamp).getTime(),
    dstMinAmountPerTrade: BN(order.ask_dstMinAmount).eq(1)
      ? ""
      : order.ask_dstMinAmount,
    triggerPricePerTrade: "",
    srcAmountPerTrade: order.ask_srcBidAmount,
    txHash: order.transactionHash,
    totalTradesAmount: chunks,
    isMarketPrice: type === V1Type.TWAP_MARKET,
    chainId,
    filledOrderTimestamp: filledOrderTimestamp ?? 0,
    status,
    rawOrder: order,
  };
}

/** Convert parsed v1 order to table display shape (like ListOrder). */
export function toV1OrderDisplay(parsed: TwapV1OrderParsed): TwapV1OrderDisplay {
  const statusStr =
    parsed.status === V1Status.Completed
      ? "completed"
      : parsed.status === V1Status.Canceled
        ? "cancelled"
        : parsed.status === V1Status.Expired
          ? "failed"
          : "pending";
  const orderTypeStr =
    parsed.type === V1Type.TWAP_MARKET
      ? "TWAP (Market)"
      : parsed.type === V1Type.TWAP_LIMIT
        ? "TWAP (Limit)"
        : "Limit";

  return {
    __source: "v1",
    hash: parsed.txHash || parsed.id,
    timestamp: new Date(parsed.createdAt).toISOString(),
    totalUSDAmount: parsed.orderDollarValueIn,
    inputToken: parsed.srcTokenAddress,
    outputToken: parsed.dstTokenAddress,
    exchangeAdapter: parsed.exchangeAddress,
    metadata: {
      expectedChunks: parsed.totalTradesAmount,
      chunkSummary: {
        success: Math.round((parsed.progress / 100) * parsed.totalTradesAmount),
        total: parsed.totalTradesAmount,
      },
      status: statusStr,
      orderType: orderTypeStr,
    },
    order: { witness: { chainId: parsed.chainId } },
    _raw: parsed,
  };
}

function getCreatedOrdersFilters(filters?: GetV1OrdersFilters): string {
  if (!filters) return "";

  const accounts = normalizeSubgraphList(filters.accounts, (a) =>
    `"${a.toLowerCase()}"`
  );
  const inTokenSymbols = normalizeSubgraphList(filters.inTokenSymbols, (s) =>
    `"${(s ?? "").toUpperCase()}"`
  );
  const outTokenSymbols = normalizeSubgraphList(filters.outTokenSymbols, (s) =>
    `"${(s ?? "").toUpperCase()}"`
  );
  const inTokenAddresses = normalizeSubgraphList(
    filters.inTokenAddresses,
    (a) => `"${a.toLowerCase()}"`
  );
  const outTokenAddresses = normalizeSubgraphList(
    filters.outTokenAddresses,
    (a) => `"${a.toLowerCase()}"`
  );
  const transactionHashes = normalizeSubgraphList(
    filters.transactionHashes,
    (h) => `"${h.toLowerCase()}"`
  );
  const orderIds = normalizeSubgraphList(filters.orderIds, (id) => `"${id}"`);
  const twapAddresses = normalizeSubgraphList(
    filters.configs?.map((c) => c.twapAddress),
    (a) => `"${a.toLowerCase()}"`
  );
  const minDollarValueIn = filters.minDollarValueIn;
  const exchanges = normalizeSubgraphList(filters.exchanges, (e) =>
    `"${e.toLowerCase()}"`
  );

  return [
    exchanges?.length ? `exchange_in: [${exchanges.join(", ")}]` : "",
    twapAddresses?.length
      ? `twapAddress_in: [${twapAddresses.join(", ")}]`
      : "",
    accounts?.length ? `maker_in: [${accounts.join(", ")}]` : "",
    transactionHashes?.length
      ? `transactionHash_in: [${transactionHashes.join(", ")}]`
      : "",
    orderIds?.length ? `Contract_id_in: [${orderIds.join(", ")}]` : "",
    minDollarValueIn ? `dollarValueIn_gte: ${minDollarValueIn}` : "",
    inTokenSymbols?.length
      ? `srcTokenSymbol_in: [${inTokenSymbols.join(", ")}]`
      : "",
    outTokenSymbols?.length
      ? `dstTokenSymbol_in: [${outTokenSymbols.join(", ")}]`
      : "",
    inTokenAddresses?.length
      ? `srcTokenAddress_in: [${inTokenAddresses.join(", ")}]`
      : "",
    outTokenAddresses?.length
      ? `dstTokenAddress_in: [${outTokenAddresses.join(", ")}]`
      : "",
    filters.startDate ? `blockTimestamp_gte: ${filters.startDate}` : "",
    filters.endDate ? `blockTimestamp_lte: ${filters.endDate}` : "",
    filters.orderType === "limit" ? "ask_dstMinAmount_gt: 1" : "",
    filters.orderType === "market" ? "ask_dstMinAmount_lte: 1" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export async function getCreatedOrders({
  chainId,
  signal,
  page,
  limit: _limit,
  filters,
}: {
  chainId: number;
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters?: GetV1OrdersFilters;
}): Promise<OrderV1[]> {
  const limit = _limit ?? 1000;
  const whereClause = getCreatedOrdersFilters(filters);

  return fetchWithRetryPaginated<OrderV1>({
    chainId,
    signal,
    limit,
    page,
    buildQuery: (p, lim) => `
      {
        orderCreateds(
          ${whereClause ? `where: { ${whereClause} }` : ""},
          first: ${lim},
          skip: ${p * lim},
          orderBy: timestamp,
          orderDirection: desc
        ) {
          id
          twapAddress
          Contract_id
          ask_bidDelay
          ask_data
          ask_deadline
          ask_dstMinAmount
          ask_dstToken
          ask_fillDelay
          ask_exchange
          ask_srcToken
          ask_srcBidAmount
          ask_srcAmount
          blockNumber
          blockTimestamp
          dex
          dollarValueIn
          dstTokenSymbol
          exchange
          maker
          srcTokenSymbol
          timestamp
          transactionHash
        }
      }
    `,
    extractResults: (json: unknown) =>
      (json as { data?: { orderCreateds?: OrderV1[] } }).data?.orderCreateds ??
      [],
  });
}

export async function getStatuses({
  chainId,
  orders,
  signal,
}: {
  chainId: number;
  orders: OrderV1[];
  signal?: AbortSignal;
}): Promise<GraphStatus[]> {
  if (orders.length === 0) return [];
  const ids = uniq(orders.map((o) => o.Contract_id.toString()));
  if (!ids.length) return [];
  const formattedIds = ids.map((id) => `"${id}"`).join(", ");
  const where = `where: { twapId_in: [${formattedIds}]}`;

  return fetchWithRetryPaginated<GraphStatus>({
    chainId,
    signal,
    limit: 1000,
    buildQuery: (p, lim) => `
      {
        statusNews(
          first: ${lim},
          skip: ${p * lim},
          ${where}
        ) {
          twapId
          twapAddress
          status
        }
      }
    `,
    extractResults: (json: unknown) =>
      (json as { data?: { statusNews?: GraphStatus[] } }).data?.statusNews ?? [],
  });
}

async function getFills({
  chainId,
  orders,
  signal,
}: {
  chainId: number;
  orders: OrderV1[];
  signal?: AbortSignal;
}): Promise<FillV1[]> {
  const ids = uniq(orders.map((o) => o.Contract_id));
  const twapAddresses = uniq(orders.map((o) => o.twapAddress)).filter(Boolean);
  if (ids.length === 0) return [];

  const formattedIds = ids.join(", ");
  const formattedTwapAddresses = twapAddresses
    .map((addr) => `"${addr}"`)
    .join(", ");
  const twapAddressClause = twapAddresses.length
    ? `twapAddress_in: [${formattedTwapAddresses}]`
    : "";
  const whereFields = [
    `TWAP_id_in: [${formattedIds}]`,
    twapAddressClause,
  ].filter(Boolean);
  const where = `where: { ${whereFields.join(", ")} }`;

  return fetchWithRetryPaginated<FillV1>({
    chainId,
    signal,
    limit: 1000,
    buildQuery: (p, lim) => `
      {
        orderFilleds(first: ${lim}, orderBy: timestamp, skip: ${p * lim}, ${where}) {
          id
          dstAmountOut
          dstFee
          srcFilledAmount
          twapAddress
          exchange
          TWAP_id
          srcAmountIn
          timestamp
          transactionHash
          dollarValueIn
          dollarValueOut
        }
      }
    `,
    extractResults: (json: unknown) => {
      const data = json as { data?: { orderFilleds?: FillV1[] } };
      const list = data.data?.orderFilleds ?? [];
      return list.map((it) => ({
        ...it,
        timestamp: new Date(it.timestamp).getTime(),
      }));
    },
  });
}

export class NoGraphEndpointError extends Error {
  constructor() {
    super("No graph endpoint found for this chain");
    this.name = "NoGraphEndpointError";
  }
}

export async function getV1Orders({
  chainId,
  signal,
  page,
  limit,
  filters,
}: {
  chainId: number;
  signal?: AbortSignal;
  page?: number;
  limit?: number;
  filters?: GetV1OrdersFilters;
}): Promise<TwapV1OrderDisplay[]> {
  try {
    const orders = await getCreatedOrders({
      chainId,
      signal,
      page,
      limit,
      filters,
    });
    const [fills, statuses] = await Promise.all([
      getFills({ chainId, orders, signal }),
      getStatuses({ chainId, orders, signal }),
    ]);

    const parsed = orders.map((o) => {
      const orderFills = fills.filter(
        (it) =>
          it.TWAP_id === Number(o.Contract_id) &&
          eqIgnoreCase(it.exchange, o.exchange) &&
          eqIgnoreCase(it.twapAddress, o.twapAddress)
      );
      return buildV1Order(
        o,
        chainId,
        orderFills,
        getStatus(o, orderFills, statuses)
      );
    });

    const sorted = parsed.sort((a, b) => b.createdAt - a.createdAt);
    return sorted.map(toV1OrderDisplay);
  } catch {
    return [];
  }
}
