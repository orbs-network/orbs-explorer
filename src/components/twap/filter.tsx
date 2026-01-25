"use client";

import { URL_QUERY_KEYS } from "@/lib/consts";
import { QueryFilters } from "@/components/query-filters";
import { OrderStatus } from "@orbs-network/spot-ui";
import { shortenAddress } from "@/lib/utils/utils";

const OrderIdFilter = () => {
  return (
    <QueryFilters.BadgeWithInput
      queryKey={URL_QUERY_KEYS.HASH}
      label="Hash"
      placeholder="Hash"
      modifyDisplayValue={shortenAddress}
    />
  );
};

const statusOptions = [
  { label: "Open", value: OrderStatus.Open.toLowerCase() },
  { label: "Completed", value: OrderStatus.Completed.toLowerCase() },
  { label: "Expired", value: OrderStatus.Expired.toLowerCase() },
  { label: "Canceled", value: OrderStatus.Canceled.toLowerCase() },
];

const StatusFilter = () => {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.ORDER_STATUS}
      label="Status"
      options={statusOptions}
    />
  );
};

const orderTypeOptions = [
  { label: "Limit", value: "limit" },
  { label: "Market", value: "market" },
];

const OrderTypeFilter = () => {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.ORDER_TYPE}
      label="Order Type"
      options={orderTypeOptions}
      singleSelect
    />
  );
};

export const OrdersFilter = () => {
  return (
    <QueryFilters>
      <OrderIdFilter />
      <StatusFilter />
      <OrderTypeFilter />
    </QueryFilters>
  );
};
