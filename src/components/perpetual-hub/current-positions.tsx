"use client";
import { useMemo } from "react";
import Link from "next/link";
import { usePerpetualHubPositionsPaginated } from "@/lib/perpetual-hub/hooks";
import type { PerpetualHubPositionListItem } from "@/lib/perpetual-hub/types";
import { formatNumber, formatUsdCompact } from "@/lib/explorer/format";
import { VirtualTable } from "@/components/virtual-table";
import { QueryFilters } from "@/components/query-filters";
import {
  PERPETUAL_HUB_CHAIN_OPTIONS,
  PERPETUAL_HUB_PARTNER_OPTIONS,
} from "@/lib/perpetual-hub/deployments";
import { URL_QUERY_KEYS } from "@/lib/consts";

const accountHref = (item: PerpetualHubPositionListItem) => {
  const query = new URLSearchParams();
  if (item.chainId) query.set("chain_id", String(item.chainId));
  if (item.contractAddress) query.set("contract", item.contractAddress);
  return `/perpetual-hub/user/${item.userAddress}?${query}`;
};
const columns = [
  {
    text: "Record",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) => (
      <span>
        {item.recordType === "position" ? "Open position" : "Pending order"}
      </span>
    ),
  },
  {
    text: "Account",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) => (
      <Link
        href={accountHref(item)}
        className="font-mono text-primary hover:underline"
      >
        {item.userAddress.slice(0, 6)}…{item.userAddress.slice(-4)}
      </Link>
    ),
  },
  {
    text: "Market / side",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) => (
      <span>
        {item.symbol || "Not reported"} · {item.side || "Not reported"}
      </span>
    ),
  },
  {
    text: "Order details",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) =>
      item.recordType === "order" ? (
        <span>
          {item.orderType || item.type || "Type not reported"}
          {item.orderId !== undefined && (
            <span className="block text-xs text-muted-foreground">
              Order #{item.orderId}
            </span>
          )}
        </span>
      ) : (
        <span>—</span>
      ),
  },
  {
    text: "Quantity",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) => (
      <span>
        {formatNumber(
          item.quantity ??
            (item.recordType === "position" ? item.positionAmt : undefined),
          6,
        )}
      </span>
    ),
  },
  {
    text: "Price",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) => (
      <span>
        {formatUsdCompact(
          Number(
            item.recordType === "position"
              ? item.entryPrice
              : Number(item.price) > 0
                ? item.price
                : item.stopPrice,
          ),
        )}
      </span>
    ),
  },
  {
    text: "Trade value",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) => (
      <span>{formatUsdCompact(Number(item.notional))}</span>
    ),
  },
  {
    text: "Network / partner",
    Component: ({ item }: { item: PerpetualHubPositionListItem }) => (
      <span>
        {item.chainName || item.chainId} · {item.partnerName || "Not reported"}
      </span>
    ),
  },
];
export function CurrentPositions() {
  const query = usePerpetualHubPositionsPaginated();
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  return (
    <VirtualTable
      title="Current positions & pending orders"
      tableItems={items}
      desktopRows={columns}
      headerLabels={columns.map(({ text }) => ({ text }))}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => query.refetch()}
      warnings={query.data?.pages[0]?.warnings ?? []}
      isFetchingNextPage={query.isFetchingNextPage}
      hasNextPage={query.hasNextPage}
      fetchNextPage={() => {
        if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
      }}
      headerAction={
        <QueryFilters
          filters={{ userFilter: true, minDollarValueFilter: true }}
        >
          <QueryFilters.Select
            label="Network"
            queryKey={URL_QUERY_KEYS.CHAIN_ID}
            options={PERPETUAL_HUB_CHAIN_OPTIONS}
          />
          <QueryFilters.Select
            label="Trading app"
            queryKey={URL_QUERY_KEYS.PARTNER_ID}
            options={PERPETUAL_HUB_PARTNER_OPTIONS}
          />
          <QueryFilters.Select
            label="Records"
            queryKey={URL_QUERY_KEYS.POSITION_ITEM_TYPE}
            options={[
              { label: "Positions", value: "position" },
              { label: "Orders", value: "order" },
            ]}
          />
        </QueryFilters>
      }
    />
  );
}
