import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  getPerpetualHubEvent,
  getPerpetualHubEvents,
  getPerpetualHubHedgerPositions,
  getPerpetualHubPositions,
  getPerpetualHubRisk,
  getPerpetualHubRollup,
  getPerpetualHubRollups,
  getPerpetualHubState,
  getPerpetualHubSummary,
  getPerpetualHubUser,
  getPerpetualHubUsers,
} from "./api";
import { useQueryFilterParams } from "../hooks/use-query-filter-params";

const PAGE_SIZE = 100;

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.find(Boolean);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function queryValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return typeof value === "string" && value.length > 0 ? [value] : [];
}

function getNextOffset(
  page: { offset: number; total: number },
  returnedRows: number,
) {
  const nextOffset = page.offset + returnedRows;
  if (returnedRows === 0 || nextOffset >= page.total) return undefined;
  return nextOffset;
}

const POSITION_EVENT_TYPES = [
  "OPEN_POSITION",
  "CLOSE_POSITION",
  "LIQUIDATION",
  "CHANGE_LEVERAGE",
] as const;

const ORDER_EVENT_TYPES = [
  "CREATE_LIMIT_ORDER",
  "CREATE_STOP_ORDER",
  "FILL_ORDER",
  "CANCEL_ORDER",
] as const;

const POSITION_ORDER_EVENT_TYPES = [
  ...POSITION_EVENT_TYPES,
  ...ORDER_EVENT_TYPES,
] as const;

const POSITION_ORDER_EVENT_TYPE_SET = new Set<string>(
  POSITION_ORDER_EVENT_TYPES,
);

function getPositionOrderEventTypes(
  itemType?: string,
  selectedTypes: string[] = [],
) {
  const scopedTypes =
    itemType === "position"
      ? POSITION_EVENT_TYPES
      : itemType === "order"
        ? ORDER_EVENT_TYPES
        : POSITION_ORDER_EVENT_TYPES;

  if (!selectedTypes.length) return [...scopedTypes];

  const selectedPositionOrderTypes = selectedTypes.filter((type) =>
    POSITION_ORDER_EVENT_TYPE_SET.has(type),
  );

  if (!selectedPositionOrderTypes.length) return [];

  return scopedTypes.filter((type) =>
    selectedPositionOrderTypes.includes(type),
  );
}

export function usePerpetualHubSummary() {
  const {
    query: { chain_id, partner_id, contract },
  } = useQueryFilterParams();
  const filters = {
    chain_id: queryValues(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useQuery({
    queryKey: [
      "perpetualHubSummary",
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal }) => getPerpetualHubSummary(filters, signal),
    refetchInterval: 30_000,
  });
}

export function usePerpetualHubState(seq: string | number) {
  const {
    query: { chain_id, partner_id, contract },
  } = useQueryFilterParams();
  const filters = {
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useQuery({
    queryKey: [
      "perpetualHubState",
      String(seq),
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal }) => getPerpetualHubState(seq, signal, filters),
    enabled: String(seq).length > 0,
  });
}

export function usePerpetualHubRollup(id: string | number) {
  const {
    query: { chain_id, partner_id, contract },
  } = useQueryFilterParams();
  const filters = {
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useQuery({
    queryKey: [
      "perpetualHubRollup",
      String(id),
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal }) => getPerpetualHubRollup(id, signal, filters),
    enabled: String(id).length > 0,
  });
}

export function usePerpetualHubUsersPaginated() {
  const {
    query: { user, chain_id, partner_id, contract, min_dollar_value },
  } = useQueryFilterParams();

  const filters = {
    user: firstQueryValue(user),
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
    min_dollar_value,
  };

  return useInfiniteQuery({
    queryKey: [
      "perpetualHubUsersPaginated",
      filters.user,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
      filters.min_dollar_value,
    ],
    queryFn: ({ signal, pageParam }) =>
      getPerpetualHubUsers(
        {
          limit: PAGE_SIZE,
          offset: pageParam as number,
          filters,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getNextOffset(lastPage, lastPage.users.length),
    refetchInterval: 15_000,
  });
}

export function usePerpetualHubUser(address: string) {
  const {
    query: { chain_id, partner_id, contract },
  } = useQueryFilterParams();
  const filters = {
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useQuery({
    queryKey: [
      "perpetualHubUser",
      address,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal }) => getPerpetualHubUser(address, signal, filters),
    enabled: /^0x[a-fA-F0-9]{40}$/.test(address),
  });
}

export function usePerpetualHubEvent(id: string | number) {
  const searchParams = useSearchParams();
  const filters = {
    chain_id: searchParams.get("chain_id") ?? undefined,
    partner_id: searchParams.get("partner_id") ?? undefined,
    contract: searchParams.get("contract") ?? undefined,
    seq: searchParams.get("seq") ?? undefined,
  };

  return useQuery({
    queryKey: [
      "perpetualHubEvent",
      String(id),
      filters.chain_id,
      filters.partner_id,
      filters.contract,
      filters.seq,
    ],
    queryFn: ({ signal }) => getPerpetualHubEvent(id, signal, filters),
    enabled: /^\d+$/.test(String(id)),
  });
}

export function usePerpetualHubActionsPaginated() {
  const {
    query: { user, status, symbol, type, chain_id, partner_id, contract },
  } = useQueryFilterParams();

  const filters = {
    user: firstQueryValue(user),
    status,
    symbol,
    type: queryValues(type),
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useInfiniteQuery({
    queryKey: [
      "perpetualHubActionsPaginated",
      filters.user,
      filters.status,
      filters.symbol,
      filters.type,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal, pageParam }) =>
      getPerpetualHubEvents(
        {
          limit: PAGE_SIZE,
          offset: pageParam as number,
          filters,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getNextOffset(lastPage, lastPage.events.length),
    refetchInterval: 10_000,
  });
}

export function usePerpetualHubPositionOrderEventsPaginated() {
  const {
    query: {
      item_type,
      user,
      status,
      symbol,
      type,
      chain_id,
      partner_id,
      contract,
    },
  } = useQueryFilterParams();

  const operationTypes = getPositionOrderEventTypes(
    firstQueryValue(item_type),
    queryValues(type),
  );
  const filters = {
    user: firstQueryValue(user),
    status,
    symbol,
    type: operationTypes,
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useInfiniteQuery({
    queryKey: [
      "perpetualHubPositionOrderEventsPaginated",
      firstQueryValue(item_type),
      filters.user,
      filters.status,
      filters.symbol,
      filters.type,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal, pageParam }) =>
      getPerpetualHubEvents(
        {
          limit: PAGE_SIZE,
          offset: pageParam as number,
          filters,
        },
        signal,
      ),
    enabled: operationTypes.length > 0,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getNextOffset(lastPage, lastPage.events.length),
    refetchInterval: 10_000,
  });
}

export function usePerpetualHubPositionsPaginated() {
  const {
    query: {
      item_type,
      user,
      symbol,
      side,
      order_type,
      min_dollar_value,
      chain_id,
      partner_id,
      contract,
    },
  } = useQueryFilterParams();

  const filters = {
    item_type: firstQueryValue(item_type),
    user: firstQueryValue(user),
    symbol,
    side,
    order_type: firstQueryValue(order_type),
    min_dollar_value,
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useInfiniteQuery({
    queryKey: [
      "perpetualHubPositionsPaginated",
      filters.item_type,
      filters.user,
      filters.symbol,
      filters.side,
      filters.order_type,
      filters.min_dollar_value,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal, pageParam }) =>
      getPerpetualHubPositions(
        {
          limit: PAGE_SIZE,
          offset: pageParam as number,
          filters,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getNextOffset(lastPage, lastPage.items.length),
    refetchInterval: 15_000,
  });
}

export function usePerpetualHubRiskPaginated() {
  const {
    query: { symbol, min_dollar_value, chain_id, partner_id, contract },
  } = useQueryFilterParams();

  const filters = {
    symbol,
    min_dollar_value,
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useInfiniteQuery({
    queryKey: [
      "perpetualHubRiskPaginated",
      filters.symbol,
      filters.min_dollar_value,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal, pageParam }) =>
      getPerpetualHubRisk(
        {
          limit: PAGE_SIZE,
          offset: pageParam as number,
          filters,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getNextOffset(lastPage, lastPage.exposures.length),
    refetchInterval: 15_000,
  });
}

export function usePerpetualHubHedgerPositionsPaginated() {
  const {
    query: { symbol, side, min_dollar_value, chain_id, partner_id, contract },
  } = useQueryFilterParams();

  const filters = {
    symbol,
    side,
    min_dollar_value,
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useInfiniteQuery({
    queryKey: [
      "perpetualHubHedgerPositionsPaginated",
      filters.symbol,
      filters.side,
      filters.min_dollar_value,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal, pageParam }) =>
      getPerpetualHubHedgerPositions(
        {
          limit: PAGE_SIZE,
          offset: pageParam as number,
          filters,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getNextOffset(lastPage, lastPage.positions.length),
    refetchInterval: 15_000,
  });
}

export function usePerpetualHubRollupsPaginated() {
  const {
    query: { status, hash, chain_id, partner_id, contract },
  } = useQueryFilterParams();

  const filters = {
    status,
    hash,
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useInfiniteQuery({
    queryKey: [
      "perpetualHubRollupsPaginated",
      filters.status,
      filters.hash,
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal, pageParam }) =>
      getPerpetualHubRollups(
        {
          limit: PAGE_SIZE,
          offset: pageParam as number,
          filters,
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      getNextOffset(lastPage, lastPage.rollups.length),
    refetchInterval: 15_000,
  });
}

export function usePerpetualHubActionTypes() {
  const {
    query: { chain_id, partner_id, contract },
  } = useQueryFilterParams();

  const filters = {
    chain_id: firstQueryValue(chain_id),
    partner_id: firstQueryValue(partner_id),
    contract,
  };

  return useQuery({
    queryKey: [
      "perpetualHubActionTypes",
      filters.chain_id,
      filters.partner_id,
      filters.contract,
    ],
    queryFn: ({ signal }) =>
      getPerpetualHubEvents(
        {
          limit: 1,
          offset: 0,
          filters,
        },
        signal,
      ),
    select: (data) => Object.keys(data.stats?.byType ?? {}).sort(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
