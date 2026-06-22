"use client";

import Link from "next/link";
import { useExplorerBatch } from "@/lib/explorer/hooks";
import { ROUTES } from "@/lib/routes";
import { Hash } from "@/components/explorer/ui/hash";
import { Mono, formatId, truncateHash } from "@/components/explorer/ui/mono";
import { OpTypePill } from "@/components/explorer/ui/op-type-pill";
import { StatusBadge } from "@/components/explorer/ui/status-badge";
import { RelativeTime } from "@/components/explorer/ui/relative-time";
import {
  arbiscanBlockUrl,
  arbiscanTxUrl,
  formatInteger,
  formatTimestamp,
  formatUsdShort,
} from "@/lib/explorer/format";
import type {
  PerpetualHubOperation,
  PerpetualHubRollup,
} from "@/lib/perpetual-hub/types";

export function ExplorerBatch({ id }: { id: string }) {
  const q = useExplorerBatch(id);

  if (q.isPending) {
    return <BatchSkeleton id={id} />;
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load batch #{id}.{" "}
        <button
          onClick={() => q.refetch()}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  const { rollup, operations } = q.data;
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BatchHeader rollup={rollup} opCount={operations.length} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SettlementCard rollup={rollup} />
        <RootsCard rollup={rollup} />
      </div>
      <OperationsTable operations={operations} />
    </div>
  );
}

// ---------- Header ----------

function BatchHeader({
  rollup,
  opCount,
}: {
  rollup: PerpetualHubRollup;
  opCount: number;
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          Batch {formatId(rollup.id)}
        </h1>
        <StatusBadge status={rollup.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Mono>
          {opCount} operation{opCount === 1 ? "" : "s"}
        </Mono>
        <span aria-hidden>·</span>
        <Mono>
          seq {formatInteger(rollup.oldSequence)}–{formatInteger(rollup.newSequence)}
        </Mono>
        {rollup.submittedAt ? (
          <>
            <span aria-hidden>·</span>
            <span>
              submitted{" "}
              <RelativeTime
                timestamp={rollup.submittedAt}
                className="text-foreground"
              />
            </span>
          </>
        ) : null}
      </div>
    </header>
  );
}

// ---------- Settlement & Roots cards ----------

function SettlementCard({ rollup }: { rollup: PerpetualHubRollup }) {
  return (
    <SectionCard title="L1 settlement">
      {rollup.txHash ? (
        <DataRow label="L1 anchor tx">
          <Hash
            value={rollup.txHash}
            href={arbiscanTxUrl(rollup.txHash)}
            external
          />
        </DataRow>
      ) : (
        <DataRow label="L1 anchor tx">
          <span className="text-xs text-muted-foreground">
            awaiting confirmation
          </span>
        </DataRow>
      )}
      {rollup.blockNumber ? (
        <DataRow label="L1 block">
          <Hash
            value={String(rollup.blockNumber)}
            href={arbiscanBlockUrl(rollup.blockNumber)}
            external
            full
          />
        </DataRow>
      ) : null}
      <DataRow label="Submitted">
        <Mono className="text-foreground">
          {formatTimestamp(rollup.submittedAt)}
        </Mono>
      </DataRow>
      {rollup.confirmedAt ? (
        <DataRow label="Confirmed">
          <Mono className="text-foreground">
            {formatTimestamp(rollup.confirmedAt)}
          </Mono>
        </DataRow>
      ) : null}
      <DataRow label="Settlement chain">
        <Mono className="text-muted-foreground">arbitrum one</Mono>
      </DataRow>
    </SectionCard>
  );
}

function RootsCard({ rollup }: { rollup: PerpetualHubRollup }) {
  return (
    <SectionCard title="State transition">
      <DataRow label="Sequence range">
        <Mono className="text-foreground">
          {formatInteger(rollup.oldSequence)} → {formatInteger(rollup.newSequence)}
        </Mono>
      </DataRow>
      <DataRow label="Old state root">
        <Hash value={rollup.oldStateRoot} full />
      </DataRow>
      <DataRow label="New state root">
        <Hash value={rollup.newStateRoot} full />
      </DataRow>
      <DataRow label="Operations">
        <Mono className="text-foreground">
          {formatInteger(rollup.operationsCount)}
        </Mono>
      </DataRow>
    </SectionCard>
  );
}

// ---------- Operations table ----------

function OperationsTable({
  operations,
}: {
  operations: PerpetualHubOperation[];
}) {
  if (operations.length === 0) {
    return (
      <SectionCard title="Operations">
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no operations in this batch
        </p>
      </SectionCard>
    );
  }
  // Sort ascending by sequence so the batch reads chronologically.
  const sorted = [...operations].sort(
    (a, b) => (a.teeSequence ?? 0) - (b.teeSequence ?? 0)
  );
  return (
    <SectionCard title={`Operations (${operations.length})`}>
      <ul className="divide-y divide-border">
        {sorted.map((op, i) => (
          <OperationRow
            key={`${op.teeSequence ?? "noseq"}-${op.id ?? i}`}
            op={op}
          />
        ))}
      </ul>
    </SectionCard>
  );
}

function OperationRow({ op }: { op: PerpetualHubOperation }) {
  const seq = op.teeSequence;
  const href = seq !== undefined ? ROUTES.EXPLORER.BLOCK(seq) : undefined;
  const amount = formatUsdShort(op.amount);
  const inner = (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,8rem)_auto_auto]">
      <Mono className="text-sm text-foreground group-hover:text-primary">
        {seq !== undefined ? formatId(seq) : "—"}
      </Mono>
      <div className="flex items-center gap-2 min-w-0">
        <OpTypePill type={op.operationType} />
        {op.userAddress ? (
          <Link
            href={ROUTES.EXPLORER.ADDRESS(op.userAddress)}
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:inline truncate font-mono text-xs text-primary hover:underline"
          >
            {truncateHash(op.userAddress)}
          </Link>
        ) : null}
      </div>
      <Mono className="hidden sm:inline truncate text-xs text-muted-foreground">
        {op.symbol ? (
          <>
            {op.symbol}
            {op.side ? ` · ${op.side.toUpperCase()}` : ""}
          </>
        ) : null}
      </Mono>
      <Mono className="hidden sm:inline text-xs text-muted-foreground text-right">
        {amount}
      </Mono>
      <StatusBadge status={op.status} />
    </div>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="group block transition-colors hover:bg-muted/40">
          {inner}
        </Link>
      ) : (
        <div className="group">{inner}</div>
      )}
    </li>
  );
}

// ---------- Skeleton ----------

function BatchSkeleton({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          Batch #{id}
        </h1>
        <span className="block h-3 w-44 animate-pulse rounded bg-muted/60" />
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <span className="block h-56 animate-pulse rounded-md bg-muted/30" />
        <span className="block h-56 animate-pulse rounded-md bg-muted/30" />
      </div>
      <span className="block h-72 animate-pulse rounded-md bg-muted/30" />
    </div>
  );
}

// ---------- Shared ----------

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <header className="border-b border-border px-3 py-2">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h2>
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3 px-3 py-2 text-sm sm:grid-cols-[8.5rem_1fr]">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
