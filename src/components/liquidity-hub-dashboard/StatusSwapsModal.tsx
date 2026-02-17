"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LiquidityHubSwap } from "@/lib/liquidity-hub/types";
import { ExternalLink, Search, ArrowRight } from "lucide-react";

/** Try to get a human-readable error from the swap (Elastic may store it in different fields). */
function getSwapError(swap: LiquidityHubSwap): string | undefined {
  const e = swap.error?.trim();
  if (e) return e;
  // rawStr might contain error info when normalized from Elastic
  const raw = swap.rawStr as Record<string, unknown> | undefined;
  if (raw && typeof raw.error === "string" && raw.error.trim()) return raw.error.trim();
  return undefined;
}
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { Virtuoso } from "react-virtuoso";
import { useToken } from "@/lib/hooks/use-token";
import { formatUsd } from "@/lib/utils/utils";

function formatDate(ts: string | number): string {
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function filterSwaps(swaps: LiquidityHubSwap[], query: string): LiquidityHubSwap[] {
  if (!query.trim()) return swaps;
  const q = query.trim().toLowerCase();
  return swaps.filter((s) => {
    const session = (s.sessionId ?? "").toLowerCase();
    const tx = (s.txHash ?? "").toLowerCase();
    const usd = String(s.amountInUSD ?? s.dollarValue2 ?? "").toLowerCase();
    const date = formatDate(s.timestamp).toLowerCase();
    const src = (s.tokenInSymbol ?? "").toLowerCase();
    const dst = (s.tokenOutSymbol ?? "").toLowerCase();
    const err = (s.error ?? "").toLowerCase();
    return (
      session.includes(q) ||
      tx.includes(q) ||
      usd.includes(q) ||
      date.includes(q) ||
      src.includes(q) ||
      dst.includes(q) ||
      err.includes(q)
    );
  });
}

function sortByCreatedAt(swaps: LiquidityHubSwap[]): LiquidityHubSwap[] {
  return [...swaps].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return tb - ta;
  });
}

export type StatusSwapsModalVariant = "success" | "failed";

const variantBorderColors: Record<StatusSwapsModalVariant, string> = {
  success: "border-l-emerald-500/60",
  failed: "border-l-destructive/60",
};

function SwapRowTokenPair({ swap }: { swap: LiquidityHubSwap }) {
  const srcToken = useToken(swap.tokenInAddress, swap.chainId).data;
  const dstToken = useToken(swap.tokenOutAddress, swap.chainId).data;
  const src = swap.tokenInSymbol ?? srcToken?.symbol ?? "—";
  const dst = swap.tokenOutSymbol ?? dstToken?.symbol ?? "—";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="font-semibold text-foreground">{src}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/70" />
      <span className="font-semibold text-foreground">{dst}</span>
    </span>
  );
}

function SwapRow({
  swap,
  variant,
}: {
  swap: LiquidityHubSwap;
  variant: StatusSwapsModalVariant;
}) {
  const usd = swap.amountInUSD ?? swap.dollarValue2 ?? 0;
  const errorText = variant === "failed" ? getSwapError(swap) : undefined;

  return (
    <div
      className={`rounded-lg border border-border border-l-4 bg-muted/30 p-3.5 text-sm ${variantBorderColors[variant]}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <SwapRowTokenPair swap={swap} />
        <span
          className={`font-semibold tabular-nums shrink-0 ${
            usd > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        >
          {formatUsd(Number(usd))}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Link
          href={ROUTES.LIQUIDITY_HUB.TX(swap.sessionId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-primary hover:underline"
        >
          {swap.sessionId.slice(0, 10)}…{swap.sessionId.slice(-8)}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </Link>
        <span className="text-border">·</span>
        <span className="text-muted-foreground/90">{formatDate(swap.timestamp)}</span>
      </div>
      {errorText && (
        <div className="mt-2 pt-2 border-t border-destructive/20 bg-destructive/5 rounded-b -mx-3.5 -mb-3.5 px-3.5 pb-3.5">
          <p className="text-muted-foreground text-sm line-clamp-2" title={errorText}>
            {errorText}
          </p>
        </div>
      )}
    </div>
  );
}

export function StatusSwapsModal({
  open,
  onOpenChange,
  partnerName,
  swaps,
  title,
  variant,
  emptyMessage = "No swaps in this period.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  swaps: LiquidityHubSwap[];
  title: string;
  variant: StatusSwapsModalVariant;
  emptyMessage?: string;
}) {
  const [filterQuery, setFilterQuery] = useState("");

  const sorted = useMemo(() => sortByCreatedAt(swaps), [swaps]);
  const filtered = useMemo(
    () => filterSwaps(sorted, filterQuery),
    [sorted, filterQuery]
  );

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
            placeholder="Filter by session, tx, amount, date…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-9"
            aria-label={`Filter ${title.toLowerCase()} swaps`}
          />
        </div>

        <p className="text-muted-foreground text-xs mt-2 shrink-0">
          {filtered.length === sorted.length
            ? `${sorted.length} swap${sorted.length === 1 ? "" : "s"}`
            : `${filtered.length} of ${sorted.length} swap${filtered.length === 1 ? "" : "s"}`}
        </p>

        <div className="flex-1 min-h-0 flex flex-col mt-3 -mx-1 px-1 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              {sorted.length === 0 ? emptyMessage : "No swaps match the filter."}
            </p>
          ) : (
            <div className="flex-1 min-h-0 w-full overflow-hidden" style={{ height: 320 }}>
              <Virtuoso
                style={{ height: "100%" }}
                data={filtered}
                overscan={20}
                itemContent={(index, swap) => (
                  <div className="pb-2">
                    <SwapRow swap={swap} variant={variant} />
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
