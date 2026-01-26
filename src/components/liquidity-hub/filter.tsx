"use client";

import { QueryFilters } from "../query-filters";
import { URL_QUERY_KEYS } from "@/lib/consts";
import { shortenAddress } from "@/lib/utils/utils";

const SessionIdFilter = () => {
  return (
    <QueryFilters.BadgeWithInput
      queryKey={URL_QUERY_KEYS.SESSION_ID}
      label="Session ID"
      placeholder="Session ID"
      modifyDisplayValue={shortenAddress}
    />
  );
};

const TxHashFilter = () => {
  return (
    <QueryFilters.BadgeWithInput
      queryKey={URL_QUERY_KEYS.HASH}
      label="Tx Hash"
      placeholder="Transaction Hash"
      modifyDisplayValue={shortenAddress}
    />
  );
};

const STATUS_OPTIONS = [
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
];

const SwapStatusFilter = () => {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.STATUS}
      label="Status"
      options={STATUS_OPTIONS}
      singleSelect
    />
  );
};

export const LHSwapsFilter = () => {
  return (
    <QueryFilters
      filters={{
        userFilter: true,
        partnerIdFilter: true,
        chainIdFilter: true,
        minDollarValueFilter: true,
      }}
    >
      <SessionIdFilter />
      <TxHashFilter />
      <SwapStatusFilter />
    </QueryFilters>
  );
};
