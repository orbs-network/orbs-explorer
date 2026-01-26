"use client";
import { useCallback, useMemo } from "react";
import moment from "moment";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Clock } from "lucide-react";
import { useNetwork } from "@/lib/hooks/use-network";
import { abbreviate, shortenAddress } from "@/lib/utils/utils";
import { VirtualTable } from "../virtual-table";
import { map } from "lodash";
import { ROUTES } from "@/lib/routes";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useLHSwaps } from "@/lib/liquidity-hub/queries";
import { LiquidityHubSwap } from "@/lib/liquidity-hub/types";
import { usePartner } from "@/lib/hooks/use-partner";
import { Partner } from "../ui/partner";
import { useToken } from "@/lib/hooks/use-token";
import { LHSwapsFilter } from "./filter";
import { SwapStatusBadge } from "./status-badge";

const Timestamp = ({ item }: { item: LiquidityHubSwap }) => {
  return (
    <div className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-foreground">
        {moment(item.timestamp).format("MMM D, YYYY")}
      </span>
      <span className="text-muted-foreground text-xs">
        {moment(item.timestamp).format("HH:mm")}
      </span>
    </div>
  );
};

const TradeUSDValue = ({ item }: { item: LiquidityHubSwap }) => {
  const amountF = abbreviate(item.amountInUSD || item.dollarValue2 || 0, 2);
  const value = item.amountInUSD || item.dollarValue2 || 0;

  return (
    <span
      className={
        value > 0 ? "text-foreground font-medium" : "text-muted-foreground"
      }
    >
      {value > 0 ? `$${amountF}` : "-"}
    </span>
  );
};

const Status = ({ item }: { item: LiquidityHubSwap }) => {
  return <SwapStatusBadge swapStatus={item.swapStatus} />;
};

const PartnerCell = ({ item }: { item: LiquidityHubSwap }) => {
  const partner = usePartner(item.dex);
  const network = useNetwork(item.chainId);

  return (
    <Partner
      data={partner || undefined}
      variant="with-subtitle"
      subtitle={network?.shortname}
    />
  );
};

const SessionId = ({ item }: { item: LiquidityHubSwap }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono text-primary hover:text-primary/80 cursor-pointer transition-colors">
          {shortenAddress(item.sessionId)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span className="text-xs font-mono">{item.sessionId}</span>
      </TooltipContent>
    </Tooltip>
  );
};

const TokenPair = ({ item }: { item: LiquidityHubSwap }) => {
  const srcToken = useToken(item.tokenInAddress, item.chainId).data;
  const dstToken = useToken(item.tokenOutAddress, item.chainId).data;
  return (
    <div className="flex flex-row gap-2 items-center">
      <span className="text-sm font-medium text-foreground">
        {srcToken?.symbol || item.tokenInSymbol}
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">
        {dstToken?.symbol || item.tokenOutSymbol}
      </span>
    </div>
  );
};

const FeesUsd = ({ item }: { item: LiquidityHubSwap }) => {
  const { feeOutAmountUsd } = item;
  return feeOutAmountUsd ? `$${abbreviate(feeOutAmountUsd.toString(), 2)}` : "-";
};

const desktopRows = [
  {
    Component: SessionId,
    text: "Session ID",
  },
  {
    Component: PartnerCell,
    text: "Partner",
  },
  {
    Component: Timestamp,
    text: "Timestamp",
  },
  {
    Component: TokenPair,
    text: "Token Pair",
  },
  {
    Component: TradeUSDValue,
    text: "USD",
  },
  {
    Component: FeesUsd,
    text: "Fees",
  },
  {
    Component: Status,
    text: "Status",
  },
];

const headerLabels = map(desktopRows, (row) => ({
  text: row.text,
}));

export function LiquidityHubTable() {
  const { push } = useRouter();
  const { data, isLoading, isFetchingNextPage, fetchNextPage } = useLHSwaps();

  const swaps = useMemo(() => {
    return data?.pages.flatMap((page) => page) || [];
  }, [data]);

  const onSelect = useCallback(
    (swap: LiquidityHubSwap) => {
      push(ROUTES.LIQUIDITY_HUB.TX(swap.sessionId));
    },
    [push]
  );

  return (
    <VirtualTable<LiquidityHubSwap>
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      tableItems={swaps}
      headerLabels={headerLabels}
      desktopRows={desktopRows}
      onSelect={onSelect}
      onMobileRowClick={onSelect}
      title="Liquidity Hub Swaps"
      headerAction={<LHSwapsFilter />}
    />
  );
}
