"use client";
import { useCallback } from "react";
import moment from "moment";
import BN from "bignumber.js";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Clock, Copy } from "lucide-react";
import { OrderStatusBadge } from "./order-status-badge";
import { useNetwork } from "@/lib/hooks/use-network";
import { abbreviate, parseListOrderStatus, shortenAddress } from "@/lib/utils/utils";
import { VirtualTable } from "../virtual-table";
import { useSpotOrdersPaginated } from "@/lib/hooks/twap-hooks/use-spot-orders";
import { map } from "lodash";
import { ROUTES } from "@/lib/routes";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ListOrder } from "@/lib/types";
import { useSpotPartner } from "@/lib/hooks/twap-hooks/use-spot-partner";
import { Partner } from "../ui/partner";
import { OrdersFilter } from "./filter";
import { TwapSinkEnvSelect } from "./sink-env-select";
import { useToken } from "@/lib/hooks/use-token";

const Timestamp = ({ item }: { item: ListOrder }) => {
  return (
    <div className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-foreground">{moment(item.timestamp).format("MMM D, YYYY")}</span>
      <span className="text-muted-foreground text-xs">
        {moment(item.timestamp).format("HH:mm")}
      </span>
    </div>
  );
};

const TradeUSDValue = ({ item }: { item: ListOrder }) => {
  const amountF = abbreviate(item.totalUSDAmount || 0, 2);

  return (
    <span className={BN(item.totalUSDAmount || 0).gt(0) ? "text-foreground font-medium" : "text-muted-foreground"}>
      {BN(item.totalUSDAmount || 0).gt(0) ? `$${amountF}` : "-"}
    </span>
  );
};

const Status = ({ item }: { item: ListOrder }) => {
  
  return (
    <OrderStatusBadge
      totalTrades={item.metadata.expectedChunks}
      filledTrades={item.metadata.chunkSummary.success}
      status={item.metadata.status}
    />
  );
};

const OrderTypeComponent = ({ item }: { item: ListOrder }) => {
  return (
    <span className="px-2 py-1 bg-muted rounded text-xs font-medium text-muted-foreground">
      {item.metadata.orderType}
    </span>
  );
};

const PartnerCell = ({ item }: { item: ListOrder }) => {
  const dex = useSpotPartner(item.exchangeAdapter);
  const network = useNetwork(dex?.chainId);

  return (
    <Partner
      data={dex?.partner || undefined}
      variant="with-subtitle"
      subtitle={network?.name}
    />
  );
};

const TxHash = ({ item }: { item: ListOrder }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono text-primary hover:text-primary/80 cursor-pointer transition-colors">
          {shortenAddress(item.hash)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span className="text-xs font-mono">{item.hash}</span>
      </TooltipContent>
    </Tooltip>
  );
};

const TokenPair = ({ item }: { item: ListOrder }) => {
  const {chainId} = useSpotPartner(item.exchangeAdapter);
  const srcToken = useToken(item.inputToken, chainId).data;
  const dstToken = useToken(item.outputToken, chainId).data;
  return (
    <div className="flex flex-row gap-2 items-center">
      <span className="text-sm font-medium text-foreground">{srcToken?.symbol}</span>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{dstToken?.symbol}</span>
    </div>
  );
};

const desktopRows = [
  {
    Component: TxHash,
    text: "Tx Hash",
  },
  {
    Component: PartnerCell,
    text: "Partner",
  },
  {
    Component: OrderTypeComponent,
    text: "Type",
  },
  {
    Component: Timestamp,
    text: "Timestamp",
  },
  {
    Component: TradeUSDValue,
    text: "USD",
  },
  {
    Component: TokenPair,
    text: "Token Pair",
  },
  {
    Component: Status,
    text: "Status",
  },
];

const headerLabels = map(desktopRows, (row) => ({
  text: row.text,
}));

export function TwapOrdersTable() {
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const isDev = searchParams.get("dev") === "true";
  const { orders, isLoading, isFetchingNextPage, fetchNextPage } =
    useSpotOrdersPaginated();

  const onSelect = useCallback(
    (order: ListOrder) => {
      const search = typeof window !== "undefined" ? window.location.search : "";
      push(`${ROUTES.TWAP.ORDER(order.hash)}${search}`);
    },
    [push],
  );

  return (
    <VirtualTable<ListOrder>
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      tableItems={orders}
      headerLabels={headerLabels}
      desktopRows={desktopRows}
      onSelect={onSelect}
      title="TWAP Orders"
      headerAction={
        <div className="flex items-center gap-2">
          {isDev && <TwapSinkEnvSelect />}
          <OrdersFilter />
        </div>
      }
    />
  );
}
