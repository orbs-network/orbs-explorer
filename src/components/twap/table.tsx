"use client";
import { useCallback } from "react";
import moment from "moment";
import BN from "bignumber.js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronRight, Clock, Copy } from "lucide-react";
import { OrderStatusBadge } from "./order-status-badge";
import { useNetwork } from "@/lib/hooks/use-network";
import { abbreviate, shortenAddress } from "@/lib/utils/utils";
import { VirtualTable } from "../virtual-table";
import { useSpotOrdersPaginated } from "@/lib/hooks/use-spot-orders";
import { map } from "lodash";
import { ROUTES } from "@/lib/routes";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ListOrder } from "@/lib/types";
import { useTwapPartner } from "@/lib/hooks/twap-hooks";
import { Partner } from "../ui/partner";

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
      status={item.metadata.displayOnlyStatus}
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
  const dex = useTwapPartner(item.exchangeAdapter);
  const network = useNetwork(dex?.chainId);

  return (
    <Partner
      data={dex?.partner || undefined}
      variant="with-subtitle"
      subtitle={network?.shortname}
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
        <Copy className="w-3 h-3 text-muted-foreground" />
      </TooltipContent>
    </Tooltip>
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
    Component: Status,
    text: "Status",
  },
];

const headerLabels = map(desktopRows, (row) => ({
  text: row.text,
}));

export function TwapOrdersTable() {
  const { push } = useRouter();
  const { orders, isLoading, isFetchingNextPage, fetchNextPage } =
    useSpotOrdersPaginated();

  const onSelect = useCallback(
    (order: ListOrder) => {
      push(ROUTES.TWAP.ORDER(order.hash));
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
    />
  );
}
