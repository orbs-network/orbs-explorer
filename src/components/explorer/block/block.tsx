"use client";

import Link from "next/link";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ROUTES } from "@/lib/routes";
import { useExplorerBlock, useExplorerBlockBatch } from "@/lib/explorer/hooks";
import { Hash } from "@/components/explorer/ui/hash";
import { Mono, formatId, truncateHash } from "@/components/explorer/ui/mono";
import { OpTypePill } from "@/components/explorer/ui/op-type-pill";
import { StatusBadge } from "@/components/explorer/ui/status-badge";
import { RelativeTime } from "@/components/explorer/ui/relative-time";
import {
  arbiscanBlockUrl,
  arbiscanTxUrl,
  formatNumber,
  formatTimestamp,
  formatUsdCompact,
  formatUsdShort,
} from "@/lib/explorer/format";
import type {
  PerpetualHubOperation,
  PerpetualHubRollup,
  PerpetualHubStateDetail,
} from "@/lib/perpetual-hub/types";

export function ExplorerBlock({ seq }: { seq: string }) {
  const blockQ = useExplorerBlock(seq);
  const block = blockQ.data;
  const rollupId = block?.transition?.rollupId;
  const batchQ = useExplorerBlockBatch(rollupId, block?.sequenceNumber);

  if (blockQ.isPending) {
    return <BlockSkeleton seq={seq} />;
  }
  if (blockQ.isError || !block) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load block #{seq}.{" "}
        <button
          onClick={() => blockQ.refetch()}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <BlockHeader block={block} />
      <Tabs defaultValue="transition">
        <TabsList>
          <TabsTrigger value="transition">Transition</TabsTrigger>
          <TabsTrigger value="state">State</TabsTrigger>
        </TabsList>
        <TabsContent value="transition">
          <TransitionTab
            block={block}
            op={batchQ.data?.op}
            rollup={batchQ.data?.rollup}
            batchLoading={batchQ.isPending && rollupId !== undefined}
          />
        </TabsContent>
        <TabsContent value="state">
          <StateTab block={block} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Header ----------

function BlockHeader({ block }: { block: PerpetualHubStateDetail }) {
  const rollupId = block.transition?.rollupId;
  const createdAt = block.transition?.createdAt;
  return (
    <header className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          Block {formatId(block.sequenceNumber)}
        </h1>
        {rollupId !== undefined ? (
          <Link
            href={ROUTES.EXPLORER.BATCH(rollupId)}
            className="font-mono text-xs uppercase tracking-wider text-[var(--explorer-success)] hover:underline"
          >
            ✓ settled in batch {formatId(rollupId)}
          </Link>
        ) : (
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--explorer-warning)]">
            ⏳ pending settlement
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {block.transition?.opType ? <OpTypePill type={block.transition.opType} /> : null}
        {createdAt ? (
          <>
            <span>
              applied <RelativeTime timestamp={createdAt} className="text-foreground" />
            </span>
            <span aria-hidden>·</span>
            <span className="font-mono">{formatTimestamp(createdAt)}</span>
          </>
        ) : null}
      </div>
    </header>
  );
}

// ---------- Transition tab ----------

function TransitionTab({
  block,
  op,
  rollup,
  batchLoading,
}: {
  block: PerpetualHubStateDetail;
  op: PerpetualHubOperation | undefined;
  rollup: PerpetualHubRollup | undefined;
  batchLoading: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex flex-col gap-4">
        <SectionCard title="Transition">
          <DataRow label="Operation">
            {block.transition?.opType ? (
              <OpTypePill type={block.transition.opType} />
            ) : (
              <Mono className="text-muted-foreground">—</Mono>
            )}
          </DataRow>
          <DataRow label="Sequence">
            <Mono className="text-foreground">{formatId(block.sequenceNumber)}</Mono>
          </DataRow>
          <DataRow label="Previous root">
            <Hash value={block.transition?.prevRoot} full />
          </DataRow>
          <DataRow label="New root">
            <Hash
              value={block.transition?.newRoot ?? block.merkleRoot}
              full
            />
          </DataRow>
          <DataRow label="State Merkle root">
            <Hash value={block.merkleRoot} full />
          </DataRow>
        </SectionCard>

        <OperationCard op={op} loading={batchLoading} block={block} />
      </div>

      <div className="flex flex-col gap-4">
        <SettlementCard block={block} rollup={rollup} loading={batchLoading} />
      </div>
    </div>
  );
}

function OperationCard({
  op,
  loading,
  block,
}: {
  op: PerpetualHubOperation | undefined;
  loading: boolean;
  block: PerpetualHubStateDetail;
}) {
  const rollupId = block.transition?.rollupId;

  if (rollupId === undefined) {
    return (
      <SectionCard title="Operation payload">
        <p className="px-3 py-3 text-xs text-muted-foreground">
          Payload will be available once this sequence is rolled up to L1.
        </p>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <SectionCard title="Operation payload">
        <ul className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="grid grid-cols-[7rem_1fr] gap-3 px-3 py-2">
              <span className="block h-3 w-20 animate-pulse rounded bg-muted/60" />
              <span className="block h-3 w-40 animate-pulse rounded bg-muted/60" />
            </li>
          ))}
        </ul>
      </SectionCard>
    );
  }

  if (!op) {
    return (
      <SectionCard title="Operation payload">
        <p className="px-3 py-3 text-xs text-muted-foreground">
          Couldn&apos;t locate the matching operation in batch{" "}
          {formatId(rollupId)}.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Operation payload">
      {op.userAddress ? (
        <DataRow label="Address">
          <Hash
            value={op.userAddress}
            href={ROUTES.EXPLORER.ADDRESS(op.userAddress)}
            hashClassName="text-primary"
          />
        </DataRow>
      ) : null}
      {op.symbol ? (
        <DataRow label="Symbol">
          <Mono className="text-foreground">{op.symbol}</Mono>
        </DataRow>
      ) : null}
      {op.side ? (
        <DataRow label="Side">
          <Mono className="text-foreground">{op.side.toUpperCase()}</Mono>
        </DataRow>
      ) : null}
      {op.quantity ? (
        <DataRow label="Quantity">
          <Mono className="text-foreground">{formatNumber(op.quantity)}</Mono>
        </DataRow>
      ) : null}
      {op.price ? (
        <DataRow label="Price">
          <Mono className="text-foreground">{formatNumber(op.price, 6)}</Mono>
        </DataRow>
      ) : null}
      {op.amount ? (
        <DataRow label="Amount">
          <Mono className="text-foreground">{formatUsdShort(op.amount) || formatNumber(op.amount)}</Mono>
        </DataRow>
      ) : null}
      {op.fee ? (
        <DataRow label="Fee">
          <Mono className="text-muted-foreground">{formatNumber(op.fee, 6)}</Mono>
        </DataRow>
      ) : null}
      {op.realizedPnl ? (
        <DataRow label="Realized PnL">
          <PnlValue value={op.realizedPnl} />
        </DataRow>
      ) : null}
      <DataRow label="Status">
        <StatusBadge status={op.status} />
      </DataRow>
      {op.rejectReason ? (
        <DataRow label="Reject reason">
          <span className="text-xs text-destructive">{op.rejectReason}</span>
        </DataRow>
      ) : null}
    </SectionCard>
  );
}

function SettlementCard({
  block,
  rollup,
  loading,
}: {
  block: PerpetualHubStateDetail;
  rollup: PerpetualHubRollup | undefined;
  loading: boolean;
}) {
  const rollupId = block.transition?.rollupId;
  const txHash = rollup?.txHash;
  const blockNumber = rollup?.blockNumber;
  const status = rollup?.status;

  return (
    <SectionCard title="L1 settlement">
      {rollupId !== undefined ? (
        <DataRow label="Batch">
          <Link
            href={ROUTES.EXPLORER.BATCH(rollupId)}
            className="font-mono text-primary hover:underline"
          >
            {formatId(rollupId)}
          </Link>
        </DataRow>
      ) : (
        <DataRow label="Batch">
          <span className="text-xs text-[var(--explorer-warning)]">
            pending — not yet rolled up
          </span>
        </DataRow>
      )}
      {status ? (
        <DataRow label="Batch status">
          <StatusBadge status={status} />
        </DataRow>
      ) : null}
      {txHash ? (
        <DataRow label="L1 anchor tx">
          <Hash value={txHash} href={arbiscanTxUrl(txHash)} external />
        </DataRow>
      ) : rollupId !== undefined && loading ? (
        <DataRow label="L1 anchor tx">
          <span className="block h-3 w-40 animate-pulse rounded bg-muted/60" />
        </DataRow>
      ) : rollupId !== undefined ? (
        <DataRow label="L1 anchor tx">
          <span className="text-xs text-muted-foreground">
            awaiting confirmation
          </span>
        </DataRow>
      ) : null}
      {blockNumber ? (
        <DataRow label="L1 block">
          <Hash
            value={String(blockNumber)}
            href={arbiscanBlockUrl(blockNumber)}
            external
            full
          />
        </DataRow>
      ) : null}
      <DataRow label="Settlement chain">
        <Mono className="text-muted-foreground">arbitrum one</Mono>
      </DataRow>
      <p className="px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Sequences don&apos;t have their own L1 tx — settlement is anchored at
        the batch level. All sequences in the same batch share its anchor tx.
      </p>
    </SectionCard>
  );
}

// ---------- State tab ----------

function StateTab({ block }: { block: PerpetualHubStateDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <MetricsRow block={block} />
      <ExposureTable block={block} />
      <TopAddressesTable block={block} />
    </div>
  );
}

function MetricsRow({ block }: { block: PerpetualHubStateDetail }) {
  const m = block.metrics;
  return (
    <section
      aria-label="State metrics"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3"
    >
      <SmallStat label="Addresses" value={formatNumber(m.users, 0)} />
      <SmallStat label="Open positions" value={formatNumber(m.openPositions, 0)} />
      <SmallStat label="Pending orders" value={formatNumber(m.pendingOrders, 0)} />
      <SmallStat label="Open interest" value={formatUsdCompact(m.openInterest)} />
      <SmallStat label="User balance" value={formatUsdCompact(m.totalUserBalance)} />
      <SmallStat label="Platform fees" value={formatUsdCompact(m.platformFeesCollected)} />
    </section>
  );
}

function SmallStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-base font-semibold tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}

function ExposureTable({ block }: { block: PerpetualHubStateDetail }) {
  const rows = block.exposureBySymbol;
  return (
    <SectionCard title="Exposure by symbol">
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no open exposure
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-mono font-medium">Symbol</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Long OI</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Short OI</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Net qty</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Positions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.symbol}>
                  <td className="px-3 py-2 font-mono text-foreground">{row.symbol}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--explorer-success)]">
                    {formatUsdCompact(row.longNotional)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-destructive">
                    {formatUsdCompact(row.shortNotional)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {formatNumber(row.netQuantity, 4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {row.positions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function TopAddressesTable({ block }: { block: PerpetualHubStateDetail }) {
  const rows = block.users;
  return (
    <SectionCard title="Top addresses at this sequence">
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no addresses in this state
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-mono font-medium">Address</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Balance</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Positions</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Pending orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((u) => (
                <tr key={u.address}>
                  <td className="px-3 py-2">
                    <Link
                      href={ROUTES.EXPLORER.ADDRESS(u.address)}
                      className="font-mono text-primary hover:underline"
                    >
                      {truncateHash(u.address)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {formatUsdCompact(u.balance)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {u.positions}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {u.pendingOrders}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ---------- Skeleton ----------

function BlockSkeleton({ seq }: { seq: string }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          Block #{seq}
        </h1>
        <span className="block h-3 w-32 animate-pulse rounded bg-muted/60" />
      </header>
      <span className="block h-9 w-44 animate-pulse rounded-md bg-muted/40" />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <span className="block h-64 animate-pulse rounded-md bg-muted/30" />
        <span className="block h-64 animate-pulse rounded-md bg-muted/30" />
      </div>
    </div>
  );
}

// ---------- Shared bits ----------

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

function PnlValue({ value }: { value: number | string }) {
  const n = Number(value);
  const tone =
    n > 0
      ? "text-[var(--explorer-success)]"
      : n < 0
      ? "text-destructive"
      : "text-foreground";
  return (
    <Mono className={tone}>
      {n > 0 ? "+" : ""}
      {formatNumber(value, 6)}
    </Mono>
  );
}
