"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ListOrder } from "@/lib/types";
import { ExternalLink, Search, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Virtuoso } from "react-virtuoso";
import { useToken } from "@/lib/hooks/use-token";
import { useSpotPartner } from "@/lib/hooks/twap-hooks/use-spot-partner";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const { chainId } = useSpotPartner(order.exchangeAdapter);
  const srcToken = useToken(order.inputToken, chainId).data;
  const dstToken = useToken(order.outputToken, chainId).data;
  const src = order.metadata?.srcToken?.symbol ?? srcToken?.symbol ?? "—";
  const dst = order.metadata?.dstToken?.symbol ?? dstToken?.symbol ?? "—";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="font-semibold text-foreground">{src}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/70" />
      <span className="font-semibold text-foreground">{dst}</span>
    </span>
  );
}

function OrderRow({
  order,
  variant,
  isExpanded,
  onToggleExpand,
}: {
  order: ListOrder;
  variant: StatusOrdersModalVariant;
  isExpanded: boolean;
  onToggleExpand: () => void;
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
    <div
      className={`rounded-lg border border-border border-l-4 bg-muted/30 p-3.5 text-sm ${variantBorderColors[variant]}`}
    >
      {/* Row 1: Token pair (primary) + USD */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <OrderRowTokenPair order={order} />
        <span
          className={`font-semibold tabular-nums shrink-0 ${
            usd > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        >
          {formatUsd(usd)}
        </span>
      </div>
      {/* Row 2: Type + chunks only */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1.5">
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
      {/* Row 3: Hash link + date */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Link
          href={ROUTES.TWAP.ORDER(order.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-primary hover:underline"
        >
          {order.hash.slice(0, 10)}…{order.hash.slice(-8)}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </Link>
        <span className="text-border">·</span>
        <span className="text-muted-foreground/90">{formatDate(order.timestamp)}</span>
      </div>
      {/* Error description */}
      {hasDesc && (
        <div className="mt-2 pt-2 border-t border-destructive/20 bg-destructive/5 rounded-b -mx-3.5 -mb-3.5 px-3.5 pb-3.5">
          <p
            className={`text-muted-foreground text-sm ${isExpanded ? "" : "line-clamp-2"}`}
          >
            {desc}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleExpand();
            }}
            className="text-destructive/90 dark:text-destructive font-medium text-sm mt-1 hover:underline flex items-center gap-0.5"
          >
            {isExpanded ? (
              <>Show less <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>Read more <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        </div>
      )}
    </div>
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
  const [expandedHashes, setExpandedHashes] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => sortByCreatedAt(orders), [orders]);

  const filtered = useMemo(
    () => filterOrders(sorted, filterQuery),
    [sorted, filterQuery]
  );

  const toggleExpanded = useCallback((hash: string) => {
    setExpandedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] max-h-[85vh] flex flex-col gap-0 overflow-hidden">
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

        <p className="text-muted-foreground text-xs mt-2 shrink-0">
          {filtered.length === sorted.length
            ? `${sorted.length} order${sorted.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${sorted.length} order${filtered.length === 1 ? "" : "s"}`}
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
                    <OrderRow
                      order={order}
                      variant={variant}
                      isExpanded={expandedHashes.has(order.hash)}
                      onToggleExpand={() => toggleExpanded(order.hash)}
                    />
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
