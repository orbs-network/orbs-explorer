"use client";
import { useCallback, useMemo } from "react";
import moment from "moment";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { useNetwork } from "@/lib/hooks/use-network";
import { usePartner } from "@/lib/hooks/use-partner";
import { useToken } from "@/lib/hooks/use-token";
import { abbreviate, shortenAddress } from "@/lib/utils/utils";
import { useLHSwaps } from "@/lib/liquidity-hub/queries";
import { LiquidityHubSwap } from "@/lib/liquidity-hub/types";
import { ROUTES } from "@/lib/routes";
import { VirtualTable } from "../virtual-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Partner } from "../ui/partner";
import { LHSwapsFilter } from "./filter";
import { SwapStatusBadge } from "./status-badge";

// ============================================================================
// Cell Components
// ============================================================================

const TimestampCell = ({ item }: { item: LiquidityHubSwap }) => {
  const date = useMemo(() => moment(item.timestamp), [item.timestamp]);
  
  return (
    <div className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-foreground">{date.format("MMM D, YYYY")}</span>
      <span className="text-muted-foreground text-xs">{date.format("HH:mm")}</span>
    </div>
  );
};

const UsdValueCell = ({ item }: { item: LiquidityHubSwap }) => {
  const value = item.amountInUSD || item.dollarValue2 || 0;
  const formatted = abbreviate(value, 2);

  return (
    <span className={value > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
      {value > 0 ? `$${formatted}` : "-"}
    </span>
  );
};

const StatusCell = ({ item }: { item: LiquidityHubSwap }) => (
  <SwapStatusBadge swapStatus={item.swapStatus} />
);

const PartnerCell = ({ item }: { item: LiquidityHubSwap }) => {
  const partner = usePartner(item.dex);
  const network = useNetwork(item.chainId);

  return (
    <Partner
      data={partner}
      variant="with-subtitle"
      subtitle={network?.shortname}
    />
  );
};

const SessionIdCell = ({ item }: { item: LiquidityHubSwap }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="font-mono text-primary hover:text-primary/80 cursor-pointer transition-colors">
        {shortenAddress(item.sessionId)}
      </span>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      <span className="text-xs font-mono">{item.sessionId}</span>
    </TooltipContent>
  </Tooltip>
);

const TokenPairCell = ({ item }: { item: LiquidityHubSwap }) => {
  const srcToken = useToken(item.tokenInAddress, item.chainId).data;
  const dstToken = useToken(item.tokenOutAddress, item.chainId).data;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-foreground">
        {srcToken?.symbol || item.tokenInSymbol || "???"}
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">
        {dstToken?.symbol || item.tokenOutSymbol || "???"}
      </span>
    </div>
  );
};

const FeesCell = ({ item }: { item: LiquidityHubSwap }) => {
  const { feeOutAmountUsd } = item;
  
  return (
    <span className={feeOutAmountUsd ? "text-foreground" : "text-muted-foreground"}>
      {feeOutAmountUsd ? `$${abbreviate(feeOutAmountUsd, 2)}` : "-"}
    </span>
  );
};

// ============================================================================
// Table Configuration
// ============================================================================

const TABLE_COLUMNS = [
  { Component: SessionIdCell, text: "Session ID" },
  { Component: PartnerCell, text: "Partner" },
  { Component: TimestampCell, text: "Timestamp" },
  { Component: TokenPairCell, text: "Token Pair" },
  { Component: UsdValueCell, text: "USD" },
  { Component: FeesCell, text: "Fees" },
  { Component: StatusCell, text: "Status" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((col) => ({ text: col.text }));

// ============================================================================
// Main Component
// ============================================================================

export function LiquidityHubTable() {
  const router = useRouter();
  const { data, isLoading, isFetchingNextPage, fetchNextPage } = useLHSwaps();

  const swaps = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data]
  );

  const handleSelect = useCallback(
    (swap: LiquidityHubSwap) => {
      router.push(ROUTES.LIQUIDITY_HUB.TX(swap.sessionId));
    },
    [router]
  );

  return (
    <VirtualTable<LiquidityHubSwap>
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      tableItems={swaps}
      headerLabels={HEADER_LABELS}
      desktopRows={TABLE_COLUMNS}
      onSelect={handleSelect}
      onMobileRowClick={handleSelect}
      title="Liquidity Hub Swaps"
      headerAction={<LHSwapsFilter />}
    />
  );
}
