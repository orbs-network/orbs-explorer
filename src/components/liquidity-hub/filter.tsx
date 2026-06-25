"use client";

import { FilterOption, QueryFilters } from "../query-filters";
import { URL_QUERY_KEYS } from "@/lib/consts";
import { isValidWalletAddress, shortenAddress } from "@/lib/utils/utils";

// ============================================================================
// Filter Options
// ============================================================================

const STATUS_OPTIONS = [
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
];

// ============================================================================
// Filter Components
// ============================================================================

const SessionIdFilter = () => (
  <QueryFilters.BadgeWithInput
    queryKey={URL_QUERY_KEYS.SESSION_ID}
    label="Session ID"
    placeholder="Enter session ID"
    modifyDisplayValue={shortenAddress}
  />
);

const TxHashFilter = () => (
  <QueryFilters.BadgeWithInput
    queryKey={URL_QUERY_KEYS.HASH}
    label="Tx Hash"
    placeholder="Enter transaction hash"
    modifyDisplayValue={shortenAddress}
  />
);

const UserAddressFilter = () => (
  <QueryFilters.BadgeWithInput
    queryKey={URL_QUERY_KEYS.USER}
    label="User Address"
    placeholder="Enter user address"
    modifyDisplayValue={shortenAddress}
    validateValue={isValidWalletAddress}
  />
);

const SwapStatusFilter = () => (
  <QueryFilters.Badge
    queryKey={URL_QUERY_KEYS.STATUS}
    label="Status"
    options={STATUS_OPTIONS}
    singleSelect
  />
);

// ============================================================================
// Main Filter Component
// ============================================================================

export function LHSwapsFilter() {
  return (
    <QueryFilters
      filters={{
        partnerIdFilter: true,
        chainIdFilter: true,
        minDollarValueFilter: true,
      }}
    >
      <UserAddressFilter />
      <SessionIdFilter />
      <TxHashFilter />
      <SwapStatusFilter />
    </QueryFilters>
  );
}
