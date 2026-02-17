"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PartnerCard, PartnerStats } from "@/lib/orders-dashboard";
import type { ListOrder } from "@/lib/types";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  ChevronRight,
} from "lucide-react";
import { usePartner } from "@/lib/hooks/use-partner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Network } from "@/components/ui/network";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusOrdersModal } from "./StatusOrdersModal";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/utils/utils";

function isFilledOrder(order: ListOrder): boolean {
  return (order.metadata?.status ?? "") === "completed";
}
function isPartiallyFilledOrder(order: ListOrder): boolean {
  return (order.metadata?.status ?? "") === "partially_completed";
}
function isPendingOrder(order: ListOrder): boolean {
  return (order.metadata?.status ?? "") === "pending";
}
function isErrorOrder(order: ListOrder): boolean {
  const status = order.metadata?.status ?? "";
  return (
    status !== "completed" &&
    status !== "partially_completed" &&
    status !== "pending"
  );
}

const sortByCreatedAtDesc = (a: ListOrder, b: ListOrder) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

const statRow = (
  label: string,
  value: string | number,
  icon: React.ReactNode,
  valueClassName?: string,
  onClick?: () => void
) => {
  const content = (
    <>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums flex items-center gap-1",
          valueClassName ?? "text-foreground"
        )}
      >
        {value}
        {onClick && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        key={label}
        onClick={onClick}
        className="flex w-full items-center justify-between py-2.5 border-b border-border/50 last:border-0 text-left transition-colors hover:bg-muted/50 rounded-sm -mx-1 px-1 cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      key={label}
      className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
    >
      {content}
    </div>
  );
};

function ChainStatsContent({
  stats,
  orders,
  onOpenFilled,
  onOpenPartial,
  onOpenPending,
  onOpenError,
}: {
  stats: PartnerStats;
  orders: ListOrder[];
  onOpenFilled: () => void;
  onOpenPartial: () => void;
  onOpenPending: () => void;
  onOpenError: () => void;
}) {
  const filledOrders = useMemo(
    () => orders.filter(isFilledOrder).sort(sortByCreatedAtDesc),
    [orders]
  );
  const partialOrders = useMemo(
    () => orders.filter(isPartiallyFilledOrder).sort(sortByCreatedAtDesc),
    [orders]
  );
  const pendingOrders = useMemo(
    () => orders.filter(isPendingOrder).sort(sortByCreatedAtDesc),
    [orders]
  );
  const errorOrders = useMemo(
    () => orders.filter(isErrorOrder).sort(sortByCreatedAtDesc),
    [orders]
  );

  return (
    <>
      {statRow(
        "Total orders",
        stats.totalOrders,
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      )}
      {statRow(
        "Total USD",
        formatUsd(stats.totalUsd),
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      )}
      {statRow(
        "Filled",
        stats.filledOrders,
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
        "text-emerald-600 dark:text-emerald-400",
        stats.filledOrders > 0 ? onOpenFilled : undefined
      )}
      {statRow(
        "Partially filled",
        stats.partiallyFilledOrders,
        <AlertCircle className="h-4 w-4 text-amber-500" />,
        "text-amber-600 dark:text-amber-400",
        stats.partiallyFilledOrders > 0 ? onOpenPartial : undefined
      )}
      {statRow(
        "Error / failed",
        stats.errorOrders,
        <XCircle className="h-4 w-4 text-destructive" />,
        "text-destructive",
        stats.errorOrders > 0 ? onOpenError : undefined
      )}
      {statRow(
        "Pending",
        stats.pendingOrders,
        <Clock className="h-4 w-4 text-muted-foreground" />,
        "text-muted-foreground",
        stats.pendingOrders > 0 ? onOpenPending : undefined
      )}
    </>
  );
}

export function PartnerStatsCard({ partnerCard }: { partnerCard: PartnerCard }) {
  const { partnerId, partnerName, chains } = partnerCard;
  const partner = usePartner(partnerId);

  const [filledModalOpen, setFilledModalOpen] = useState(false);
  const [partialModalOpen, setPartialModalOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [modalChainId, setModalChainId] = useState<number | null>(null);

  const defaultTab = chains[0] ? String(chains[0].chainId) : undefined;

  const openFilled = (chainId: number) => {
    setModalChainId(chainId);
    setFilledModalOpen(true);
  };
  const openPartial = (chainId: number) => {
    setModalChainId(chainId);
    setPartialModalOpen(true);
  };
  const openPending = (chainId: number) => {
    setModalChainId(chainId);
    setPendingModalOpen(true);
  };
  const openError = (chainId: number) => {
    setModalChainId(chainId);
    setErrorModalOpen(true);
  };

  const currentChainForModal = useMemo(
    () => (modalChainId != null ? chains.find((c) => c.chainId === modalChainId) ?? null : null),
    [modalChainId, chains]
  );

  const filledOrders = useMemo(() => {
    if (!currentChainForModal) return [];
    return currentChainForModal.orders
      .filter(isFilledOrder)
      .sort(sortByCreatedAtDesc);
  }, [currentChainForModal]);
  const partialOrders = useMemo(() => {
    if (!currentChainForModal) return [];
    return currentChainForModal.orders
      .filter(isPartiallyFilledOrder)
      .sort(sortByCreatedAtDesc);
  }, [currentChainForModal]);
  const pendingOrders = useMemo(() => {
    if (!currentChainForModal) return [];
    return currentChainForModal.orders
      .filter(isPendingOrder)
      .sort(sortByCreatedAtDesc);
  }, [currentChainForModal]);
  const errorOrders = useMemo(() => {
    if (!currentChainForModal) return [];
    return currentChainForModal.orders
      .filter(isErrorOrder)
      .sort(sortByCreatedAtDesc);
  }, [currentChainForModal]);

  const modalDisplayName = currentChainForModal
    ? `${partnerName} ${currentChainForModal.chainName}`
    : partnerName;

  const totalOrdersAcrossChains = chains.reduce(
    (sum, c) => sum + c.stats.totalOrders,
    0
  );
  const hasNoOrders = totalOrdersAcrossChains === 0;
  const singleChain = chains.length === 1 ? chains[0] : null;

  if (chains.length === 0) return null;

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden border bg-card shadow-sm transition-all hover:shadow-md",
          hasNoOrders
            ? "border-border/60 opacity-90"
            : "border-border hover:border-primary/20"
        )}
      >
        <CardHeader className="pb-2 pt-5 px-5">
          <div className="flex items-center gap-3">
            {partner && (
              <Avatar className="h-10 w-10 shrink-0 border border-border">
                <AvatarImage src={partner.logo} alt={partnerName} />
                <AvatarFallback className="text-sm bg-muted">
                  {partnerName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {partnerName}
                </h3>
                {singleChain && (
                  <Network
                    chainId={singleChain.chainId}
                    variant="compact"
                    showChainId={false}
                    className="shrink-0 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 [&_span]:text-xs"
                  />
                )}
              </div>
              {hasNoOrders && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  No orders in last 7 days
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          {singleChain ? (
            <ChainStatsContent
              stats={singleChain.stats}
              orders={singleChain.orders}
              onOpenFilled={() => openFilled(singleChain.chainId)}
              onOpenPartial={() => openPartial(singleChain.chainId)}
              onOpenPending={() => openPending(singleChain.chainId)}
              onOpenError={() => openError(singleChain.chainId)}
            />
          ) : (
            <Tabs defaultValue={defaultTab!} className="w-full">
              <TabsList className="w-fit max-w-full flex flex-wrap h-auto gap-1.5 p-1.5 mb-3 rounded-xl bg-muted/50 border border-border/50">
                {chains.map((ch) => (
                  <TabsTrigger
                    key={ch.chainId}
                    value={String(ch.chainId)}
                    className="cursor-pointer flex-none flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/30 data-[state=active]:border data-[state=active]:border-primary/20"
                  >
                    <Network
                      chainId={ch.chainId}
                      variant="compact"
                      showChainId={false}
                      className="[&_span]:text-xs"
                    />
                  </TabsTrigger>
                ))}
              </TabsList>
              {chains.map((ch) => (
                <TabsContent
                  key={ch.chainId}
                  value={String(ch.chainId)}
                  className="space-y-0 mt-0"
                >
                  <ChainStatsContent
                    stats={ch.stats}
                    orders={ch.orders}
                    onOpenFilled={() => openFilled(ch.chainId)}
                    onOpenPartial={() => openPartial(ch.chainId)}
                    onOpenPending={() => openPending(ch.chainId)}
                    onOpenError={() => openError(ch.chainId)}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
      <StatusOrdersModal
        open={filledModalOpen}
        onOpenChange={setFilledModalOpen}
        partnerName={modalDisplayName}
        orders={filledOrders}
        title="Filled"
        variant="filled"
        emptyMessage="No filled orders in this period."
      />
      <StatusOrdersModal
        open={partialModalOpen}
        onOpenChange={setPartialModalOpen}
        partnerName={modalDisplayName}
        orders={partialOrders}
        title="Partially filled"
        variant="partial"
        emptyMessage="No partially filled orders in this period."
      />
      <StatusOrdersModal
        open={pendingModalOpen}
        onOpenChange={setPendingModalOpen}
        partnerName={modalDisplayName}
        orders={pendingOrders}
        title="Pending"
        variant="pending"
        emptyMessage="No pending orders in this period."
      />
      <StatusOrdersModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        partnerName={modalDisplayName}
        orders={errorOrders}
        title="Error / failed"
        variant="error"
        emptyMessage="No error orders in this period."
      />
    </>
  );
}
