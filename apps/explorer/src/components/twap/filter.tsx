"use client";

import { URL_QUERY_KEYS } from "@orbs/domain/consts";
import { Status } from "@orbs/domain/types";
import { QueryFilters } from "@/components/query-filters";

const OrderIdFilter = () => {
  return (
    <QueryFilters.Values
      queryKey={URL_QUERY_KEYS.HASH}
      label="Order ID"
      placeholder="Order ID"
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

/** Values from order.metadata.displayOnlyStatus (order-sink API) */
const DISPLAY_STATUS_OPTIONS = [
  { label: "Pending Price Check", value: "PENDING-PRICE-CHECK" },
  { label: "Succeeded", value: "SUCCEEDED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Error", value: "ERROR" },
];

const OrderStatusFilter = () => {
  return (
    <QueryFilters.MultiSelect
      queryKey={URL_QUERY_KEYS.ORDER_STATUS}
      label="Order Status"
      options={DISPLAY_STATUS_OPTIONS}
    />
  );
};

const OrderTypeFilter = () => {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.ORDER_TYPE}
      label="Order Type"
      options={TYPE_OPTIONS}
    />
  );
};
const SwapStatusFilter = () => {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.STATUS}
      label="Swap Status"
      options={STATUS_OPTIONS}
    />
  );
};

export const OrdersFilter = () => {
  return (
    <QueryFilters
      filters={{
        userFilter: true,
        partnerIdFilter: true,
        chainIdFilter: true,
      }}
    >
      <OrderIdFilter />
      <OrderStatusFilter />
      {/* <OrderTypeFilter /> */}
      {/* <SwapStatusFilter /> */}
    </QueryFilters>
  );
};
