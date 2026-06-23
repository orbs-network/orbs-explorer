"use client";

import { QueryFilters } from "@/components/query-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatPerpetualHubActionName,
  PERPETUAL_HUB_CHAIN_OPTIONS,
  PERPETUAL_HUB_PARTNER_OPTIONS,
} from "@/lib/perpetual-hub";
import { URL_QUERY_KEYS } from "@/lib/consts";
import { useQueryFilterParams } from "@/lib/hooks/use-query-filter-params";
import { isValidWalletAddress, shortenAddress } from "@/lib/utils/utils";

const STATUS_OPTIONS = [
  { label: "Success", value: "SUCCESS" },
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
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.ACTION_TYPE}
      label="Action"
      options={ACTION_TYPE_OPTIONS}
    />
  );
}

function StatusFilter() {
  return (
    <QueryFilters.SingleBadge
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
    <QueryFilters.Input
      queryKey={URL_QUERY_KEYS.CONTRACT}
      label="Contract"
      placeholder="Search contract address"
    />
  );
}

function UserWalletFilter() {
  return (
    <QueryFilters.BadgeWithInput
      queryKey={URL_QUERY_KEYS.USER}
      label="User Wallet"
      placeholder="Insert wallet address"
      modifyDisplayValue={shortenAddress}
      validateValue={isValidWalletAddress}
    />
  );
}

function MinUserBalanceFilter() {
  return (
    <QueryFilters.Input
      queryKey={URL_QUERY_KEYS.MIN_DOLLAR_VALUE}
      label="Min Balance"
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
      label="Rollup / Tx"
      placeholder="Search rollup ID or tx hash"
    />
  );
}

function RollupStatusFilter() {
  return (
    <QueryFilters.SingleBadge
      queryKey={URL_QUERY_KEYS.STATUS}
      label="Status"
      options={ROLLUP_STATUS_OPTIONS}
    />
  );
}

function SideFilter() {
  return (
    <QueryFilters.SingleBadge
      queryKey={URL_QUERY_KEYS.POSITION_SIDE}
      label="Side"
      options={SIDE_OPTIONS}
    />
  );
}

function PositionItemTypeFilter() {
  return (
    <QueryFilters.SingleBadge
      queryKey={URL_QUERY_KEYS.POSITION_ITEM_TYPE}
      label="Type"
      options={POSITION_ITEM_TYPE_OPTIONS}
    />
  );
}

function PositionOrderActionFilter() {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.ACTION_TYPE}
      label="Action"
      options={POSITION_ORDER_ACTION_OPTIONS}
    />
  );
}

function ChainsFilter() {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.CHAIN_ID}
      label="Chains"
      options={PERPETUAL_HUB_CHAIN_OPTIONS}
      singleSelect
    />
  );
}

function OverviewChainsFilter() {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.CHAIN_ID}
      label="Chains"
      options={PERPETUAL_HUB_CHAIN_OPTIONS}
    />
  );
}

function PartnersFilter() {
  return (
    <QueryFilters.Badge
      queryKey={URL_QUERY_KEYS.PARTNER_ID}
      label="Partners"
      options={PERPETUAL_HUB_PARTNER_OPTIONS}
      singleSelect
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
      <SelectTrigger className="h-9 w-[11.5rem]" aria-label="Partner">
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
      <ActionFilter />
      <StatusFilter />
      <MarketFilter />
      <ContractFilter />
      <UserWalletFilter />
      <ChainsFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualOverviewFilter() {
  return (
    <QueryFilters countKeys={[URL_QUERY_KEYS.CHAIN_ID]}>
      <OverviewChainsFilter />
    </QueryFilters>
  );
}

export function PerpetualUsersFilter() {
  return (
    <QueryFilters>
      <UserWalletFilter />
      <MinUserBalanceFilter />
      <ContractFilter />
      <ChainsFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualPositionsFilter() {
  return (
    <QueryFilters>
      <PositionItemTypeFilter />
      <PositionOrderActionFilter />
      <StatusFilter />
      <MarketFilter />
      <UserWalletFilter />
      <ContractFilter />
      <ChainsFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualRiskFilter() {
  return (
    <QueryFilters>
      <MarketFilter />
      <MinDollarFilter
        label="Min Exposure"
        placeholder="Minimum long + short open interest"
      />
      <ContractFilter />
      <ChainsFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualHedgerFilter() {
  return (
    <QueryFilters>
      <MarketFilter />
      <SideFilter />
      <MinDollarFilter label="Min Notional" placeholder="Minimum notional" />
      <ContractFilter />
      <ChainsFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}

export function PerpetualRollupsFilter() {
  return (
    <QueryFilters>
      <RollupStatusFilter />
      <RollupLookupFilter />
      <ContractFilter />
      <ChainsFilter />
      <PartnersFilter />
    </QueryFilters>
  );
}
