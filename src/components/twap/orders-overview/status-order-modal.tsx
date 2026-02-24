"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ListOrder } from "@/lib/twap";
import { ExternalLink, Search, ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Virtuoso } from "react-virtuoso";
import { useToken } from "@/lib/hooks/use-token";
import { useSpotPartnerListOrder } from "@/lib/twap";
import { Amount } from "@/components/ui/amount";
import BN from "bignumber.js";
import moment from "moment";
import { TokenDisplay } from "@/components/token-display";

function formatDate(iso: string | number): string {
  const d = moment(iso);
  return d.format("DD MMM YY");
}

function filterOrders(orders: ListOrder[], query: string): ListOrder[] {
  if (!query.trim()) return orders;
  const q = query.trim().toLowerCase();
  return orders.filter((order) => {
    const hash = order.hash.toLowerCase();
    const desc = (
      (order.metadata?.displayOnlyStatusDescription ||
        order.metadata?.description ||
        "") as string
    ).toLowerCase();
    const usdStr = (order.totalUSDAmount || "").toLowerCase();
    const dateStr = formatDate(order.timestamp).toLowerCase();
    const orderType = (order.metadata?.orderType ?? "").toLowerCase();
    return (
      hash.includes(q) ||
      desc.includes(q) ||
      usdStr.includes(q) ||
      dateStr.includes(q) ||
      orderType.includes(q)
    );
  });
}

/** Sort by created at (timestamp) descending — newest first. */
function sortByCreatedAt(orders: ListOrder[]): ListOrder[] {
  return [...orders].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return tb - ta;
  });
}

export type StatusOrdersModalVariant = "filled" | "partial" | "pending" | "error";

const variantBorderColors: Record<StatusOrdersModalVariant, string> = {
  filled: "border-l-emerald-500/60",
  partial: "border-l-amber-500/60",
  pending: "border-l-sky-500/50",
  error: "border-l-destructive/60",
};

function OrderRowTokenPair({ order }: { order: ListOrder }) {
  const { chainId } = useSpotPartnerListOrder(order);
  
  const srcToken = useToken(order.inputToken, chainId).data;
  const dstToken = useToken(order.outputToken, chainId).data;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <TokenDisplay address={srcToken?.address} chainId={chainId} />
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/70" />
      <TokenDisplay address={dstToken?.address} chainId={chainId} />
    </span>
  );
}

function OrderRow({
  order,
  variant,
}: {
  order: ListOrder;
  variant: StatusOrdersModalVariant;
}) {
  const usd = parseFloat(order.totalUSDAmount || "0");
  const desc =
    order.metadata?.displayOnlyStatusDescription ||
    order.metadata?.description ||
    "";
  const hasDesc = variant === "error" && desc.length > 0;
  const orderType = order.metadata?.orderType ?? "—";
  const chunkSummary = order.metadata?.chunkSummary;
  const chunksLabel =
    chunkSummary != null && order.metadata?.expectedChunks != null
      ? `${chunkSummary.success} / ${order.metadata.expectedChunks}`
      : null;

  return (
    <Link
      href={ROUTES.TWAP.ORDER(order.hash)}
      className={`block rounded-lg border border-border border-l-4 bg-muted/30 p-3.5 text-sm cursor-pointer transition-colors hover:bg-muted/50 hover:border-border ${variantBorderColors[variant]}`}
    >
      {/* Row 1: Token pair (primary) + USD */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <OrderRowTokenPair order={order} />
        <Amount
          amount={String(usd)}
          prefix="$"
          className={`font-semibold tabular-nums shrink-0 ${
            usd > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        />
      </div>
      {/* Row 2: Type + chunks only */}
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-1.5">
        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium border border-primary/20">
          {orderType}
        </span>
        {chunksLabel != null && (
          <>
            <span className="text-border">·</span>
            <span className="px-2 py-0.5 rounded bg-muted font-mono text-foreground/90">
              {chunksLabel}
            </span>
          </>
        )}
      </div>
      {/* Row 3: Hash + date badge */}
      <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border text-muted-foreground text-xs font-medium tabular-nums inline-flex items-center gap-1">
          {formatDate(order.timestamp)} 
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
           {formatDate(BN(order.order.witness.deadline).multipliedBy(1000).toNumber())}
        </span>
      {/* Error description — full message, no truncation */}
      {hasDesc && (
        <div className="mt-2 pt-2 border-t border-destructive/20 bg-destructive/5 rounded-b -mx-3.5 -mb-3.5 px-3.5 pb-3.5">
          <p className="text-muted-foreground text-sm whitespace-pre-wrap break-words">
            {desc}
          </p>
        </div>
      )}
    </Link>
  );
}

export function StatusOrdersModal({
  open,
  onOpenChange,
  partnerName,
  orders,
  title,
  variant,
  emptyMessage = "No orders in this period.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  orders: ListOrder[];
  title: string;
  variant: StatusOrdersModalVariant;
  emptyMessage?: string;
}) {
  const [filterQuery, setFilterQuery] = useState("");

  const sorted = useMemo(() => sortByCreatedAt(orders), [orders]);

  const filtered = useMemo(
    () => filterOrders(sorted, filterQuery),
    [sorted, filterQuery]
  );

  const totalUsd = useMemo(
    () =>
      filtered.reduce((sum, o) => sum + parseFloat(o.totalUSDAmount || "0"), 0),
    [filtered]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl h-[85vh] max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {title} — {partnerName}
          </DialogTitle>
        </DialogHeader>

        <div className="relative mt-2 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Filter by hash, description, amount, date…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-9"
            aria-label={`Filter ${title.toLowerCase()} orders`}
          />
        </div>

        <p className="text-muted-foreground text-xs mt-2 shrink-0 flex items-center gap-2">
          <span>
            {filtered.length === sorted.length
              ? `${sorted.length} order${sorted.length === 1 ? "" : "s"}`
              : `${filtered.length} of ${sorted.length} order${filtered.length === 1 ? "" : "s"}`}
          </span>
          {filtered.length > 0 && (
            <>
              <span className="text-border">·</span>
              <Amount
                amount={String(totalUsd)}
                prefix="Total: $"
                className="text-foreground font-medium"
              />
            </>
          )}
        </p>

        <div className="flex-1 min-h-0 flex flex-col mt-3 -mx-1 px-1 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              {sorted.length === 0 ? emptyMessage : "No orders match the filter."}
            </p>
          ) : (
            <div className="flex-1 min-h-0 w-full overflow-hidden" style={{ height: 320 }}>
              <Virtuoso
                style={{ height: "100%" }}
                data={filtered}
                overscan={20}
                itemContent={(index, order) => (
                  <div className="pb-2">
                    <OrderRow order={order} variant={variant} />
                  </div>
                )}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
