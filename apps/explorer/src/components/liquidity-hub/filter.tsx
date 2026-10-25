"use client";

import { QueryFilters } from "../query-filters";
import { URL_QUERY_KEYS } from "@orbs/domain/consts";
import { isValidWalletAddress } from "@orbs/domain/utils/utils";

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
  <QueryFilters.Values
    queryKey={URL_QUERY_KEYS.SESSION_ID}
    label="Swap attempt ID"
    placeholder="Enter a swap attempt ID…"
  />
);

const TxHashFilter = () => (
  <QueryFilters.Values
    queryKey={URL_QUERY_KEYS.HASH}
    label="Transaction ID"
    placeholder="Enter a transaction ID…"
  />
);

const UserAddressFilter = () => (
  <QueryFilters.Values
    queryKey={URL_QUERY_KEYS.USER}
    label="Wallet addresses"
    placeholder="0x…"
    validateValue={isValidWalletAddress}
  />
);

const SwapStatusFilter = () => (
  <QueryFilters.Select
    queryKey={URL_QUERY_KEYS.STATUS}
    label="Status"
    options={STATUS_OPTIONS}
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
