"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import BN from "bignumber.js";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { OrderStatusBadge } from "./order-status-badge";
import { useNetwork } from "@/lib/hooks/use-network";
import { Amount } from "@/components/ui/amount";
import { shortenAddress, getExplorerTxUrl } from "@/lib/utils/utils";
import { VirtualTable } from "../virtual-table";
import { useSpotOrdersPaginated, useTwapV1Orders } from "@/lib/twap";
import { map } from "lodash";
import { ROUTES } from "@/lib/routes";
import { URL_QUERY_KEYS } from "@/lib/consts";
import type { ListOrder, TwapV1OrderDisplay } from "@/lib/twap";
import { useSpotPartnerListOrder } from "@/lib/twap";
import { Partner } from "../ui/partner";
import { OrdersFilter } from "./filter";
import { TwapSinkEnvSelect } from "./sink-env-select";
import { useToken } from "@/lib/hooks/use-token";
import { TokenDisplay } from "../token-display";

export type TwapTableOrder = ListOrder | TwapV1OrderDisplay;

function isV1Order(item: TwapTableOrder): item is TwapV1OrderDisplay {
  return "__source" in item && item.__source === "v1";
}

const Timestamp = ({ item }: { item: TwapTableOrder }) => {
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

const TradeUSDValue = ({ item }: { item: TwapTableOrder }) => {
  const hasAmount = BN(item.totalUSDAmount || 0).gt(0);
  return (
    <span className={hasAmount ? "text-foreground font-medium" : "text-muted-foreground"}>
      {hasAmount ? (
        <Amount amount={item.totalUSDAmount || "0"} prefix="$" />
      ) : (
        "-"
      )}
    </span>
  );
};

const Status = ({ item }: { item: TwapTableOrder }) => {
  return (
    <OrderStatusBadge
      totalTrades={item.metadata.expectedChunks}
      filledTrades={item.metadata.chunkSummary.success}
      status={item.metadata.status}
    />
  );
};

const OrderTypeComponent = ({ item }: { item: TwapTableOrder }) => {
  const isOld = isV1Order(item);
  return (
    <div className="flex items-center gap-1.5">
      <span className="px-2 py-1 bg-muted rounded text-xs font-medium text-muted-foreground">
        {item.metadata.orderType}
      </span>
      {isOld && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
          Old
        </span>
      )}
    </div>
  );
};

const PartnerCell = ({ item }: { item: TwapTableOrder }) => {
  const dex = useSpotPartnerListOrder(item);
  
  const network = useNetwork(dex?.chainId);

  return (
    <Partner
      data={dex?.partner || undefined}
      variant="with-subtitle"
      subtitle={network?.name}
    />
  );
};

const TxHash = ({ item }: { item: TwapTableOrder }) => {
  return (
    <span className="font-mono text-primary">
      {shortenAddress(item.hash)}
    </span>
  );
};

const TokenPair = ({ item }: { item: TwapTableOrder }) => {
  const {chainId} = useSpotPartnerListOrder(item);

  const srcToken = useToken(item.inputToken, chainId).data;
  const dstToken = useToken(item.outputToken, chainId).data;
  return (
    <div className="flex flex-row gap-2 items-center">
      <TokenDisplay address={srcToken?.address} chainId={chainId} className="pointer-events-none" />
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
      <TokenDisplay address={dstToken?.address} chainId={chainId} className="pointer-events-none" />
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

const TWAP_TAB_VALUES = ["all", "new", "old"] as const;
type TwapTab = (typeof TWAP_TAB_VALUES)[number];

function parseTwapTab(value: string | null): TwapTab {
  if (value === "old" || value === "new") return value;
  return "all";
}

export function TwapOrdersTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDev = searchParams.get("dev") === "true";
  const tabFromUrl = parseTwapTab(searchParams.get(URL_QUERY_KEYS.TWAP_TAB));
  const [tab, setTab] = useState<TwapTab>(tabFromUrl);

  const setTabWithUrl = useCallback(
    (t: TwapTab) => {
      setTab(t);
      const params = new URLSearchParams(searchParams.toString());
      if (t === "old") {
        params.set(URL_QUERY_KEYS.TWAP_TAB, "old");
      } else {
        params.delete(URL_QUERY_KEYS.TWAP_TAB);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const { orders: newOrders, isLoading: newLoading, isFetchingNextPage, fetchNextPage } =
    useSpotOrdersPaginated();
  const { v1Orders, isLoading: v1Loading } = useTwapV1Orders();

  const tableItems = useMemo((): TwapTableOrder[] => {
    if (tab === "new") return newOrders;
    if (tab === "old") return v1Orders;
    const merged: TwapTableOrder[] = [...v1Orders, ...newOrders];
    return merged.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [tab, newOrders, v1Orders]);

  const isLoading = tab === "new" ? newLoading : tab === "old" ? v1Loading : newLoading || v1Loading;

  const onSelect = useCallback(
    (order: TwapTableOrder) => {
      if (isV1Order(order)) {
        const url = getExplorerTxUrl(order.order.witness.chainId, order.hash);
        if (url !== "#") window.open(url, "_blank");
      } else {
        const search = typeof window !== "undefined" ? window.location.search : "";
        router.push(`${ROUTES.TWAP.ORDER(order.hash)}${search}`);
      }
    },
    [router]
  );

  const prefetchOrder = useCallback(
    (order: TwapTableOrder) => {
      if (!isV1Order(order)) router.prefetch(ROUTES.TWAP.ORDER(order.hash));
    },
    [router]
  );

  return (
    <VirtualTable<TwapTableOrder>
      isLoading={isLoading}
      isFetchingNextPage={tab === "new" ? isFetchingNextPage : false}
      fetchNextPage={tab === "new" ? fetchNextPage : () => {}}
      tableItems={tableItems}
      headerLabels={headerLabels}
      desktopRows={desktopRows}
      onSelect={onSelect}
      onMobileRowClick={onSelect}
      onRowHover={prefetchOrder}
      title="TWAP Orders"
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            {TWAP_TAB_VALUES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTabWithUrl(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-background text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "All" : t === "new" ? "New TWAP" : "Old TWAP"}
              </button>
            ))}
          </div>
          {isDev && <TwapSinkEnvSelect />}
          <OrdersFilter />
        </div>
      }
    />
  );
}
