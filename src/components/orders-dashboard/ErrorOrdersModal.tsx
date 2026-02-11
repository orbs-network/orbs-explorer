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
import { ExternalLink, Search, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Virtuoso } from "react-virtuoso";

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

function filterOrders(
  orders: ListOrder[],
  query: string
): ListOrder[] {
  if (!query.trim()) return orders;
  const q = query.trim().toLowerCase();
  return orders.filter((order) => {
    const hash = order.hash.toLowerCase();
    const desc =
      (order.metadata?.displayOnlyStatusDescription ||
        order.metadata?.description ||
        "") as string;
    const usdStr = (order.totalUSDAmount || "").toLowerCase();
    const dateStr = formatDate(order.timestamp).toLowerCase();
    return (
      hash.includes(q) ||
      desc.toLowerCase().includes(q) ||
      usdStr.includes(q) ||
      dateStr.includes(q)
    );
  });
}

function ErrorOrderRow({
  order,
  isExpanded,
  onToggleExpand,
}: {
  order: ListOrder;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const usd = parseFloat(order.totalUSDAmount || "0");
  const desc =
    order.metadata?.displayOnlyStatusDescription ||
    order.metadata?.description ||
    "";
  const hasDesc = desc.length > 0;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={ROUTES.TWAP.ORDER(order.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-primary hover:underline truncate block"
          >
            {order.hash.slice(0, 10)}…{order.hash.slice(-8)}
            <ExternalLink className="inline h-3 w-3 ml-1" />
          </Link>
          <p
            className={`text-muted-foreground mt-1 ${
              isExpanded ? "" : "line-clamp-2"
            }`}
          >
            {desc || "—"}
          </p>
          {hasDesc && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onToggleExpand();
              }}
              className="text-primary text-xs font-medium mt-1 hover:underline flex items-center gap-0.5"
            >
              {isExpanded ? (
                <>
                  Show less <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Read more <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
          <p className="text-muted-foreground/80 text-xs mt-1">
            {formatDate(order.timestamp)}
          </p>
        </div>
        <span className="font-semibold tabular-nums shrink-0">
          {formatUsd(usd)}
        </span>
      </div>
    </div>
  );
}

export function ErrorOrdersModal({
  open,
  onOpenChange,
  partnerName,
  orders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  orders: ListOrder[];
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [expandedHashes, setExpandedHashes] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          parseFloat(b.totalUSDAmount || "0") -
          parseFloat(a.totalUSDAmount || "0")
      ),
    [orders]
  );

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
          <DialogTitle>Error / failed orders — {partnerName}</DialogTitle>
        </DialogHeader>

        <div className="relative mt-2 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Filter by hash, description, amount, date…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-9"
            aria-label="Filter error orders"
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
              {sorted.length === 0
                ? "No error orders in this period."
                : "No orders match the filter."}
            </p>
          ) : (
            <div
              className="flex-1 min-h-0 w-full overflow-hidden"
              style={{ height: 320 }}
            >
              <Virtuoso
                style={{ height: "100%" }}
                data={filtered}
                overscan={20}
                itemContent={(index, order) => (
                  <div className="pb-2">
                    <ErrorOrderRow
                      order={order}
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
