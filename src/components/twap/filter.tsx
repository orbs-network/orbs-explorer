"use client";

import { URL_QUERY_KEYS } from "@/lib/consts";
import { Status } from "@/lib/types";
import { QueryFilters } from "@/components/query-filters";
import { shortenAddress } from "@/lib/utils/utils";

const OrderIdFilter = () => {
  return (
    <QueryFilters.BadgeWithInput
      queryKey={URL_QUERY_KEYS.HASH}
      label="Order ID"
      placeholder="Order ID"
      modifyDisplayValue={shortenAddress}
    />
  );
};


const TYPE_OPTIONS = [
  { label: "Limit", value: "limit" },
  { label: "Market", value: "market" },
  { label: "Trigger Price", value: "trigger_price" },
];


const STATUS_OPTIONS = [
  { label: "Open", value: "open" },
  { label: "Completed", value: Status.COMPLETED },
  { label: "Failed", value: Status.FAILED },
  { label: "Partially Completed", value: Status.PARTIALLY_COMPLETED },
];

const OrderTypeFilter = () => {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.ORDER_TYPE}
      label="Order Type"
      options={TYPE_OPTIONS}
      singleSelect
    />
  );
};
const SwapStatusFilter = () => {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.STATUS}
      label="Swap Status"
      options={STATUS_OPTIONS}
    />
  );
};

export const OrdersFilter = () => {
  return (
    <QueryFilters filters={{
      userFilter: true,
      partnerIdFilter: true,
      chainIdFilter: true,
    }}>
      <OrderIdFilter />
      {/* <OrderTypeFilter /> */}
      {/* <SwapStatusFilter /> */}
    </QueryFilters>
  );
};
