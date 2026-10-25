"use client";

import { QueryFilters } from "@/components/query-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
import {
  formatPerpetualHubActionName,
  PERPETUAL_HUB_CHAIN_OPTIONS,
  PERPETUAL_HUB_CONTRACT_OPTIONS,
  PERPETUAL_HUB_PARTNER_OPTIONS,
} from "@orbs/domain/perpetual-hub";
import { URL_QUERY_KEYS } from "@orbs/domain/consts";
import { useQueryFilterParams } from "@orbs/domain/hooks/use-query-filter-params";
import { isValidWalletAddress } from "@orbs/domain/utils/utils";

const STATUS_OPTIONS = [
  { label: "Account updated", value: "SUCCESS" },
  { label: "Rejected", value: "REJECTED" },
];

const ACTION_TYPE_OPTIONS = [
  "CANCEL_ORDER",
  "CHANGE_LEVERAGE",
  "CLOSE_POSITION",
  "CREATE_LIMIT_ORDER",
  "CREATE_STOP_ORDER",
  "DEPOSIT",
  "FILL_ORDER",
  "FUNDING_RATE",
  "HEDGER_DEPOSIT",
  "HEDGER_WITHDRAWAL",
  "LIQUIDATION",
  "OPEN_POSITION",
  "REGISTER_SESSION_KEY",
  "RELEASE_WITHDRAWAL",
  "UPDATE_CONFIG",
  "UPDATE_USER_TIER",
  "WITHDRAWAL",
].map((type) => ({
  label: formatPerpetualHubActionName(type),
  value: type,
}));

const ROLLUP_STATUS_OPTIONS = [
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Failed", value: "FAILED" },
  { label: "Pending", value: "PENDING" },
];

const SIDE_OPTIONS = [
  { label: "Long", value: "long" },
  { label: "Short", value: "short" },
  { label: "Flat", value: "flat" },
];

const POSITION_ITEM_TYPE_OPTIONS = [
  { label: "Positions", value: "position" },
  { label: "Orders", value: "order" },
];

const POSITION_ORDER_ACTION_OPTIONS = [
  "OPEN_POSITION",
  "CLOSE_POSITION",
  "LIQUIDATION",
  "CHANGE_LEVERAGE",
  "CREATE_LIMIT_ORDER",
  "CREATE_STOP_ORDER",
  "FILL_ORDER",
  "CANCEL_ORDER",
].map((type) => ({
  label: formatPerpetualHubActionName(type),
  value: type,
}));

const ALL_PARTNERS_VALUE = "all";

function ActionFilter() {
  return (
    <QueryFilters.MultiSelect
      queryKey={URL_QUERY_KEYS.ACTION_TYPE}
      label="Action"
      options={ACTION_TYPE_OPTIONS}
      placeholder="Search action type"
    />
  );
}

function StatusFilter() {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.STATUS}
      label="Status"
      options={STATUS_OPTIONS}
    />
  );
}

function MarketFilter() {
  return (
    <QueryFilters.Input
      queryKey={URL_QUERY_KEYS.SYMBOL}
      label="Market"
      placeholder="Search market, e.g. BTCUSDT"
    />
  );
}

function ContractFilter() {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.CONTRACT}
      label="Contract"
      options={PERPETUAL_HUB_CONTRACT_OPTIONS}
    />
  );
}

function UserWalletFilter() {
  return (
    <QueryFilters.Values
      queryKey={URL_QUERY_KEYS.USER}
      label="Wallet address"
      placeholder="Enter a wallet address…"
      validateValue={isValidWalletAddress}
    />
  );
}

function MinUserBalanceFilter() {
  return (
    <QueryFilters.Input
      queryKey={URL_QUERY_KEYS.MIN_DOLLAR_VALUE}
      label="Minimum balance"
      placeholder="Minimum wallet or margin balance"
    />
  );
}

function MinDollarFilter({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <QueryFilters.Input
      queryKey={URL_QUERY_KEYS.MIN_DOLLAR_VALUE}
      label={label}
      placeholder={placeholder}
    />
  );
}

function RollupLookupFilter() {
  return (
    <QueryFilters.Input
      queryKey={URL_QUERY_KEYS.HASH}
      label="Batch or transaction ID"
      placeholder="Enter a batch or transaction ID…"
    />
  );
}

function RollupStatusFilter() {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.STATUS}
      label="Status"
      options={ROLLUP_STATUS_OPTIONS}
    />
  );
}

function SideFilter() {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.POSITION_SIDE}
      label="Side"
      options={SIDE_OPTIONS}
    />
  );
}

function PositionItemTypeFilter() {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.POSITION_ITEM_TYPE}
      label="Type"
      options={POSITION_ITEM_TYPE_OPTIONS}
    />
  );
}

function PositionOrderActionFilter() {
  return (
    <QueryFilters.MultiSelect
      queryKey={URL_QUERY_KEYS.ACTION_TYPE}
      label="Action"
      options={POSITION_ORDER_ACTION_OPTIONS}
      placeholder="Search action type"
    />
  );
}

function ChainsFilter() {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.CHAIN_ID}
      label="Networks"
      options={PERPETUAL_HUB_CHAIN_OPTIONS}
    />
  );
}

function OverviewChainsFilter() {
  return (
    <QueryFilters.MultiSelect
      queryKey={URL_QUERY_KEYS.CHAIN_ID}
      label="Networks"
      options={PERPETUAL_HUB_CHAIN_OPTIONS}
    />
  );
}

function PartnersFilter() {
  return (
    <QueryFilters.Select
      queryKey={URL_QUERY_KEYS.PARTNER_ID}
      label="Trading apps"
      options={PERPETUAL_HUB_PARTNER_OPTIONS}
    />
  );
}

function firstFilterValue(value?: string | string[]) {
  if (Array.isArray(value)) return value.find(Boolean);
  return value || undefined;
}

export function PerpetualOverviewPartnerSelect() {
  const { query, setQuery } = useQueryFilterParams();
  const selectedPartner =
    firstFilterValue(query[URL_QUERY_KEYS.PARTNER_ID]) ?? ALL_PARTNERS_VALUE;

  return (
    <Select
      value={selectedPartner}
      onValueChange={(value) => {
        setQuery.updateQuery({
          [URL_QUERY_KEYS.PARTNER_ID]:
            value === ALL_PARTNERS_VALUE ? undefined : [value],
        });
      }}
    >
      <SelectTrigger className="h-9 w-[11.5rem]" aria-label="Trading app">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_PARTNERS_VALUE}>All partners</SelectItem>
        {PERPETUAL_HUB_PARTNER_OPTIONS.map((partner) => (
          <SelectItem key={partner.value} value={partner.value}>
            {partner.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PerpetualActionsFilter() {
  return (
    <QueryFilters>
      <ChainsFilter />
      <ContractFilter />
      <ActionFilter />
      <StatusFilter />
      <MarketFilter />
      <UserWalletFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualOverviewFilter() {
  return (
    <QueryFilters
      countKeys={[URL_QUERY_KEYS.CHAIN_ID, URL_QUERY_KEYS.CONTRACT]}
    >
      <OverviewChainsFilter />
      <ContractFilter />
    </QueryFilters>
  );
}

export function PerpetualUsersFilter() {
  return (
    <QueryFilters>
      <ChainsFilter />
      <ContractFilter />
      <UserWalletFilter />
      <MinUserBalanceFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualPositionsFilter() {
  return (
    <QueryFilters>
      <ChainsFilter />
      <ContractFilter />
      <PositionItemTypeFilter />
      <PositionOrderActionFilter />
      <StatusFilter />
      <MarketFilter />
      <UserWalletFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualRiskFilter() {
  return (
    <QueryFilters>
      <ChainsFilter />
      <ContractFilter />
      <MarketFilter />
      <MinDollarFilter
        label="Minimum positions value"
        placeholder="Minimum combined positions value…"
      />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualHedgerFilter() {
  return (
    <QueryFilters>
      <ChainsFilter />
      <ContractFilter />
      <MarketFilter />
      <SideFilter />
      <MinDollarFilter
        label="Minimum trade value"
        placeholder="Minimum trade value…"
      />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualRollupsFilter() {
  return (
    <QueryFilters>
      <ChainsFilter />
      <ContractFilter />
      <RollupStatusFilter />
      <RollupLookupFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}
