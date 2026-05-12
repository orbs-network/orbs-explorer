"use client";

import Link from "next/link";
import { useExplorerBlocks } from "@/lib/explorer/hooks";
import { useListPagination } from "@/lib/explorer/use-list-pagination";
import { ROUTES } from "@/lib/routes";
import { Mono, formatId, truncateHash } from "@/components/explorer/ui/mono";
import { OpTypePill } from "@/components/explorer/ui/op-type-pill";
import { StatusBadge } from "@/components/explorer/ui/status-badge";
import { RelativeTime } from "@/components/explorer/ui/relative-time";
import { StatCard } from "@/components/explorer/ui/stat-card";
import {
  Pagination,
  PAGE_SIZE_OPTIONS,
} from "@/components/explorer/ui/pagination";
import { formatInteger } from "@/lib/explorer/format";
import type {
  PerpetualHubEventListStats,
  PerpetualHubOperation,
} from "@/lib/perpetual-hub/types";

const DEFAULT_PAGE_SIZE = 25;

export function ExplorerBlocksList() {
  const { page, pageSize, setPage, setPageSize, limit, offset } =
    useListPagination({
      defaultPageSize: DEFAULT_PAGE_SIZE,
      allowedSizes: PAGE_SIZE_OPTIONS,
    });
  const q = useExplorerBlocks({ limit, offset });

  const latestSeq = q.data?.events[0]?.teeSequence;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Header />
      <StatsStrip
        total={q.data?.total}
        stats={q.data?.stats}
        latestSeq={latestSeq}
        isLoading={q.isPending}
      />
      <section className="rounded-md border border-border bg-card">
        <header className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Blocks
          </h2>
          <p className="text-[11px] text-muted-foreground">
            applied sequences, newest first
          </p>
        </header>

        {q.isError ? (
          <ErrorRow onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <SkeletonRows count={pageSize} />
        ) : !q.data || q.data.events.length === 0 ? (
          <EmptyRow />
        ) : (
          <BlockTable events={q.data.events} />
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={q.data?.total ?? 0}
          rowsOnPage={q.data?.events.length ?? 0}
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
        Blocks
      </h1>
      <p className="text-sm text-foreground">
        Every operation applied to the perpetual hub state. Each row maps to a
        sequence number — the perp-hub equivalent of a block.
      </p>
    </header>
  );
}

// ---------- Stats ----------

function StatsStrip({
  total,
  stats,
  latestSeq,
  isLoading,
}: {
  total: number | undefined;
  stats: PerpetualHubEventListStats | undefined;
  latestSeq: number | undefined;
  isLoading: boolean;
}) {
  const typeCount = stats ? Object.keys(stats.byType).length : undefined;
  const topType = stats ? pickTopType(stats.byType) : undefined;

  return (
    <section
      aria-label="Block stats"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3"
    >
      <StatCard
        label="Total events"
        value={
          isLoading
            ? "—"
            : total !== undefined
            ? formatInteger(total)
            : "—"
        }
      />
      <StatCard
        label="Latest seq"
        value={
          isLoading
            ? "—"
            : latestSeq !== undefined
            ? `#${formatInteger(latestSeq)}`
            : "—"
        }
      />
      <StatCard
        label="Op types"
        value={
          isLoading
            ? "—"
            : typeCount !== undefined
            ? formatInteger(typeCount)
            : "—"
        }
      />
      <StatCard
        label="Most common"
        value={
          isLoading
            ? "—"
            : topType
            ? topType.label
            : "—"
        }
        sublabel={
          topType ? `${formatInteger(topType.count)} events` : undefined
        }
      />
    </section>
  );
}

function pickTopType(
  byType: Record<string, number>
): { label: string; count: number } | undefined {
  let best: { label: string; count: number } | undefined;
  for (const [label, count] of Object.entries(byType)) {
    if (!best || count > best.count) best = { label, count };
  }
  return best;
}

// ---------- Table ----------

function BlockTable({ events }: { events: PerpetualHubOperation[] }) {
  return (
    <ul className="divide-y divide-border">
      {events.map((op, i) => (
        <BlockRow key={`${op.teeSequence ?? "noseq"}-${op.id ?? i}`} op={op} />
      ))}
    </ul>
  );
}

function BlockRow({ op }: { op: PerpetualHubOperation }) {
  const seq = op.teeSequence;
  return (
    <li>
      <div className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,7rem)_minmax(0,8rem)_auto_auto]">
        {seq !== undefined ? (
          <Link
            href={ROUTES.EXPLORER.BLOCK(seq)}
            className="font-mono text-sm text-foreground group-hover:text-primary"
          >
            {formatId(seq)}
          </Link>
        ) : (
          <Mono className="text-sm text-muted-foreground">—</Mono>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <OpTypePill type={op.operationType} />
        </div>
        <Mono className="hidden sm:inline truncate text-xs text-muted-foreground">
          {op.symbol ? (
            <>
              {op.symbol}
              {op.side ? ` · ${op.side.toUpperCase()}` : ""}
            </>
          ) : null}
        </Mono>
        {op.userAddress ? (
          <Link
            href={ROUTES.EXPLORER.ADDRESS(op.userAddress)}
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:inline truncate font-mono text-xs text-primary hover:underline"
          >
            {truncateHash(op.userAddress)}
          </Link>
        ) : (
          <Mono className="hidden sm:inline text-xs text-muted-foreground">—</Mono>
        )}
        <StatusBadge status={op.status} />
        <RelativeTime timestamp={op.timestamp} className="text-xs" />
      </div>
    </li>
  );
}

// ---------- States ----------

function SkeletonRows({ count }: { count: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,7rem)_minmax(0,8rem)_auto_auto] items-center gap-3 px-3 py-2"
        >
          {Array.from({ length: 6 }).map((_, c) => (
            <span
              key={c}
              className="block h-3 animate-pulse rounded bg-muted/60"
              style={{
                width:
                  c === 0
                    ? "4rem"
                    : c === 1
                    ? "70%"
                    : c === 2
                    ? "5rem"
                    : c === 3
                    ? "6rem"
                    : c === 4
                    ? "4rem"
                    : "3rem",
              }}
            />
          ))}
        </li>
      ))}
    </ul>
  );
}

function ErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-3 py-3">
      <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Couldn&apos;t load blocks.{" "}
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
      no blocks yet
    </p>
  );
}
