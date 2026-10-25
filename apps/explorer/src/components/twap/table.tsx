"use client";

import { useCallback } from "react";
import moment from "moment";
import BN from "bignumber.js";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Clock, Copy } from "lucide-react";
import { OrderStatusBadge } from "./order-status-badge";
import { useNetwork } from "@orbs/domain/hooks/use-network";
import { Amount } from "@orbs/ui/controls/amount";
import { parseListOrderStatus, shortenAddress } from "@orbs/domain/utils/utils";
import { VirtualTable } from "../virtual-table";
import { getTwapOrderChainId, useSpotOrdersPaginated } from "@orbs/domain/twap";
import { map } from "lodash";
import { ROUTES } from "@/routes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";
import type { ListOrder } from "@orbs/domain/twap";
import { useSpotPartnerListOrder } from "@orbs/domain/twap";
import { Partner } from "@orbs/ui/controls/partner";
import { OrdersFilter } from "./filter";
import { TwapSinkEnvSelect } from "./sink-env-select";
import { TokenDisplay } from "../token-display";

const Timestamp = ({ item }: { item: ListOrder }) => {
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

const TradeUSDValue = ({ item }: { item: ListOrder }) => {
  const hasAmount = BN(item.totalUSDAmount || 0).gt(0);
  return (
    <span
      className={
        hasAmount ? "text-foreground font-medium" : "text-muted-foreground"
      }
    >
      {hasAmount ? (
        <Amount amount={item.totalUSDAmount || "0"} prefix="$" />
      ) : (
        "-"
      )}
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
  const dex = useSpotPartnerListOrder(item);

  const network = useNetwork(getTwapOrderChainId(item));

  return (
    <Partner
      data={
        dex?.partner || {
          name: dex.partnerName,
        }
      }
      variant="with-subtitle"
      subtitle={network?.name}
    />
  );
};

const TxHash = ({ item }: { item: ListOrder }) => {
  return (
    <span className="font-mono text-link">{shortenAddress(item.hash)}</span>
  );
};

const TokenPair = ({ item }: { item: ListOrder }) => {
  const chainId = getTwapOrderChainId(item);

  return (
    <div className="flex flex-row gap-2 items-center">
      <TokenDisplay
        address={item.inputToken}
        chainId={chainId}
        className="pointer-events-none"
      />
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
      <TokenDisplay
        address={item.outputToken}
        chainId={chainId}
        className="pointer-events-none"
      />
    </div>
  );
};

const desktopRows = [
  {
    Component: TxHash,
    text: "Order ID",
  },
  {
    Component: PartnerCell,
    text: "Trading app",
  },
  {
    Component: OrderTypeComponent,
    text: "Type",
  },
  {
    Component: Timestamp,
    text: "Placed at",
  },
  {
    Component: TradeUSDValue,
    text: "Order value",
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDev = searchParams.get("dev") === "true";
  const {
    orders,
    warnings,
    isLoading,
    isError,
    refetch,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useSpotOrdersPaginated();

  const navigateToOrder = useCallback(
    (order: ListOrder) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("order_source", order.source ?? "v1");
      router.push(`${ROUTES.TWAP.ORDER(order.hash)}?${params}`);
    },
    [router, searchParams],
  );

  return (
    <VirtualTable<ListOrder>
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={() => {
        if (hasNextPage && !isFetching) void fetchNextPage();
      }}
      hasNextPage={hasNextPage}
      isError={isError}
      onRetry={() => refetch()}
      warnings={warnings}
      tableItems={orders}
      headerLabels={headerLabels}
      desktopRows={desktopRows}
      onSelect={navigateToOrder}
      onMobileRowClick={navigateToOrder}
      title="Advanced orders"
      headerAction={
        <div className="flex items-center gap-2">
          {isDev && <TwapSinkEnvSelect />}
          <OrdersFilter />
        </div>
      }
    />
  );
}
