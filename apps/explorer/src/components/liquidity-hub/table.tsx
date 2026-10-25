"use client";
import { useCallback, useMemo } from "react";
import moment from "moment";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { useNetwork } from "@orbs/domain/hooks/use-network";
import { usePartner } from "@orbs/domain/hooks/use-partner";
import { useToken } from "@orbs/domain/hooks/use-token";
import { Amount } from "@orbs/ui/controls/amount";
import { shortenAddress } from "@orbs/domain/utils/utils";
import { useLHSwaps } from "@orbs/domain/liquidity-hub/queries";
import { LiquidityHubSwap } from "@orbs/domain/liquidity-hub/types";
import { ROUTES } from "@/routes";
import { VirtualTable } from "../virtual-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@orbs/ui/controls/tooltip";
import { Partner } from "@orbs/ui/controls/partner";
import { SwapStatusBadge } from "./status-badge";
import { LHSwapsFilter } from "./filter";

// ============================================================================
// Cell Components
// ============================================================================

const TimestampCell = ({ item }: { item: LiquidityHubSwap }) => {
  const date = useMemo(() => moment(item.timestamp), [item.timestamp]);

  return (
    <div className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-foreground">{date.format("MMM D, YYYY")}</span>
      <span className="text-muted-foreground text-xs">
        {date.format("HH:mm")}
      </span>
    </div>
  );
};

const UsdValueCell = ({ item }: { item: LiquidityHubSwap }) => {
  const value = item.amountInUSD || item.dollarValue2 || 0;

  return (
    <span
      className={
        value > 0 ? "text-foreground font-medium" : "text-muted-foreground"
      }
    >
      {value > 0 ? <Amount amount={String(value)} prefix="$" /> : "-"}
    </span>
  );
};

const StatusCell = ({ item }: { item: LiquidityHubSwap }) => (
  <div className="max-w-64 space-y-1">
    <SwapStatusBadge swapStatus={item.swapStatus} />
    {(item.error || item.stage) && (
      <p
        className="line-clamp-2 text-xs text-muted-foreground"
        title={item.error || item.stage}
      >
        {item.error || item.stage}
      </p>
    )}
  </div>
);

const PartnerCell = ({ item }: { item: LiquidityHubSwap }) => {
  const partner = usePartner(item.dex);
  const network = useNetwork(item.chainId);

  return (
    <Partner data={partner} variant="with-subtitle" subtitle={network?.name} />
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
    <span
      className={feeOutAmountUsd ? "text-foreground" : "text-muted-foreground"}
    >
      {feeOutAmountUsd ? (
        <Amount amount={String(feeOutAmountUsd)} prefix="$" />
      ) : (
        "-"
      )}
    </span>
  );
};

// ============================================================================
// Table Configuration
// ============================================================================

const TABLE_COLUMNS = [
  { Component: SessionIdCell, text: "Swap attempt ID" },
  { Component: PartnerCell, text: "Trading app" },
  { Component: TimestampCell, text: "Time" },
  { Component: TokenPairCell, text: "Token Pair" },
  { Component: UsdValueCell, text: "Swap value" },
  { Component: FeesCell, text: "Fees" },
  { Component: StatusCell, text: "Status" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((col) => ({ text: col.text }));

// ============================================================================
// Main Component
// ============================================================================

export function LiquidityHubTable() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useLHSwaps();

  const swaps = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data],
  );

  const handleSelect = useCallback(
    (swap: LiquidityHubSwap) => {
      router.push(ROUTES.LIQUIDITY_HUB.TX(swap.sessionId));
    },
    [router],
  );

  return (
    <VirtualTable<LiquidityHubSwap>
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={() => {
        if (hasNextPage && !isFetching) void fetchNextPage();
      }}
      hasNextPage={hasNextPage}
      isError={isError}
      onRetry={() => refetch()}
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
