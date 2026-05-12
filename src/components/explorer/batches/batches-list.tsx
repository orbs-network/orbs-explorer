"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useExplorerBatches } from "@/lib/explorer/hooks";
import { useListPagination } from "@/lib/explorer/use-list-pagination";
import { ROUTES } from "@/lib/routes";
import { Mono, formatId, truncateHash } from "@/components/explorer/ui/mono";
import { StatusBadge } from "@/components/explorer/ui/status-badge";
import { RelativeTime } from "@/components/explorer/ui/relative-time";
import { StatCard } from "@/components/explorer/ui/stat-card";
import {
  Pagination,
  PAGE_SIZE_OPTIONS,
} from "@/components/explorer/ui/pagination";
import {
  arbiscanTxUrl,
  formatInteger,
} from "@/lib/explorer/format";
import type {
  PerpetualHubRollup,
  PerpetualHubRollupListStats,
} from "@/lib/perpetual-hub/types";

const DEFAULT_PAGE_SIZE = 25;

export function ExplorerBatchesList() {
  const { page, pageSize, setPage, setPageSize, limit, offset } =
    useListPagination({
      defaultPageSize: DEFAULT_PAGE_SIZE,
      allowedSizes: PAGE_SIZE_OPTIONS,
    });
  const q = useExplorerBatches({ limit, offset });

  // Normalize the URL when ?page=N points past the real ceiling so refresh
  // doesn't preserve a stale inconsistent state. `<Pagination>` clamps
  // visually in either case; this just keeps the URL honest.
  const total = q.data?.total;
  useEffect(() => {
    if (total === undefined) return;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [total, pageSize, page, setPage]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Header />
      <StatsStrip
        total={q.data?.total}
        stats={q.data?.stats}
        isLoading={q.isPending}
      />
      <section className="rounded-md border border-border bg-card">
        <header className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Batches
          </h2>
          <p className="text-[11px] text-muted-foreground">
            rollups submitted to L1, newest first
          </p>
        </header>

        {q.isError ? (
          <ErrorRow onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <SkeletonRows count={pageSize} />
        ) : !q.data || q.data.rollups.length === 0 ? (
          <EmptyRow />
        ) : (
          <BatchTable rollups={q.data.rollups} />
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={q.data?.total ?? 0}
          rowsOnPage={q.data?.rollups.length ?? 0}
          isLoading={q.isFetching}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>
    </div>
  );
}

// ---------- Header ----------

function Header() {
  return (
    <header className="flex flex-col gap-1 border-b border-border pb-4">
      <h1 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Batches
      </h1>
      <p className="text-sm text-foreground">
        Every rollup submitted to L1. Each batch anchors a range of sequences in
        a single Arbitrum transaction.
      </p>
    </header>
  );
}

// ---------- Stats ----------

function StatsStrip({
  total,
  stats,
  isLoading,
}: {
  total: number | undefined;
  stats: PerpetualHubRollupListStats | undefined;
  isLoading: boolean;
}) {
  return (
    <section
      aria-label="Batch stats"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3"
    >
      <StatCard
        label="Total batches"
        value={
          isLoading
            ? "—"
            : total !== undefined
            ? formatInteger(total)
            : "—"
        }
      />
      <StatCard
        label="Total ops"
        value={
          isLoading
            ? "—"
            : stats?.totalOps !== undefined
            ? formatInteger(stats.totalOps)
            : "—"
        }
      />
      <StatCard
        label="Latest seq"
        value={
          isLoading
            ? "—"
            : stats?.latestSequence !== undefined
            ? `#${formatInteger(stats.latestSequence)}`
            : "—"
        }
      />
      <StatCard
        label="Avg ops / batch"
        value={isLoading ? "—" : stats?.avgOpsPerRollup ?? "—"}
      />
    </section>
  );
}

// ---------- Table ----------

function BatchTable({ rollups }: { rollups: PerpetualHubRollup[] }) {
  return (
    <ul className="divide-y divide-border">
      {rollups.map((r) => (
        <BatchRow key={r.id} rollup={r} />
      ))}
    </ul>
  );
}

function BatchRow({ rollup }: { rollup: PerpetualHubRollup }) {
  const opsLabel = `${formatInteger(rollup.operationsCount)} op${
    rollup.operationsCount === 1 ? "" : "s"
  }`;
  return (
    <li>
      <div className="group grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[6rem_auto_1fr_auto_auto_auto]">
        <Link
          href={ROUTES.EXPLORER.BATCH(rollup.id)}
          className="font-mono text-sm text-foreground group-hover:text-primary"
        >
          {formatId(rollup.id)}
        </Link>
        <StatusBadge status={rollup.status} />
        <Mono className="truncate text-xs text-muted-foreground">
          seq {formatInteger(rollup.oldSequence)}–
          {formatInteger(rollup.newSequence)}
        </Mono>
        <Mono className="hidden sm:inline text-xs text-muted-foreground">
          {opsLabel}
        </Mono>
        <TxLink txHash={rollup.txHash} />
        <RelativeTime timestamp={rollup.submittedAt} className="text-xs" />
      </div>
    </li>
  );
}

function TxLink({ txHash }: { txHash: string | undefined }) {
  if (!txHash) {
    return (
      <Mono className="hidden sm:inline text-xs text-muted-foreground">—</Mono>
    );
  }
  return (
    <a
      href={arbiscanTxUrl(txHash)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="hidden sm:inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
    >
      {truncateHash(txHash)}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

// ---------- States ----------

function SkeletonRows({ count }: { count: number }) {
  // Grid template mirrors BatchRow so the skeleton's column layout matches
  // the loaded table at every viewport.
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[6rem_auto_1fr_auto_auto_auto]"
        >
          {/* Mobile shows 4 columns; the last two only render on sm+ */}
          <span className="block h-3 w-16 animate-pulse rounded bg-muted/60" />
          <span className="block h-3 w-16 animate-pulse rounded bg-muted/60" />
          <span className="block h-3 w-3/5 animate-pulse rounded bg-muted/60" />
          <span className="hidden sm:block h-3 w-12 animate-pulse rounded bg-muted/60" />
          <span className="hidden sm:block h-3 w-20 animate-pulse rounded bg-muted/60" />
          <span className="block h-3 w-12 animate-pulse rounded bg-muted/60" />
        </li>
      ))}
    </ul>
  );
}

function ErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-3 py-3">
      <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Couldn&apos;t load batches.{" "}
        <button
          onClick={onRetry}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyRow() {
  return (
    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
      no batches yet
    </p>
  );
}
