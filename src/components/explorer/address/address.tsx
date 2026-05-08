"use client";

import Link from "next/link";
import { useExplorerAddress } from "@/lib/explorer/hooks";
import { ROUTES } from "@/lib/routes";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Hash } from "@/components/explorer/ui/hash";
import { Mono, formatId } from "@/components/explorer/ui/mono";
import { OpTypePill } from "@/components/explorer/ui/op-type-pill";
import { StatusBadge } from "@/components/explorer/ui/status-badge";
import { RelativeTime } from "@/components/explorer/ui/relative-time";
import { StatCard } from "@/components/explorer/ui/stat-card";
import {
  formatInteger,
  formatNumber,
  formatUsdCompact,
} from "@/lib/explorer/format";
import type {
  PerpetualHubOperation,
  PerpetualHubTrade,
  PerpetualHubUserDetail,
  PerpetualHubUserOrder,
  PerpetualHubUserPosition,
} from "@/lib/perpetual-hub/types";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function ExplorerAddress({ address }: { address: string }) {
  const q = useExplorerAddress(address);

  if (!ADDRESS_RE.test(address)) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-medium">Invalid address</p>
        <p className="mt-1 break-all font-mono text-xs">{address}</p>
        <p className="mt-2 text-xs">
          Addresses must match <code>0x</code> followed by 40 hex characters.
        </p>
      </div>
    );
  }

  if (q.isPending) {
    return <AddressSkeleton address={address} />;
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Couldn&apos;t load address {address}.{" "}
        <button
          onClick={() => q.refetch()}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <AddressHeader address={address} data={q.data} />
      <StatsStrip data={q.data} />
      <Tabs defaultValue="positions">
        <TabsList>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="accounting">Accounting</TabsTrigger>
        </TabsList>
        <TabsContent value="positions">
          <PositionsTab positions={q.data.current?.positions ?? []} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTab orders={q.data.current?.pendingOrders ?? []} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab events={q.data.history.events} total={q.data.history.totalEvents} />
        </TabsContent>
        <TabsContent value="trades">
          <TradesTab trades={q.data.history.trades} total={q.data.history.totalTrades} />
        </TabsContent>
        <TabsContent value="accounting">
          <AccountingTab data={q.data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Header ----------

function AddressHeader({
  address,
  data,
}: {
  address: string;
  data: PerpetualHubUserDetail;
}) {
  const nonce = data.current?.user?.nonce;
  return (
    <header className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Address
        </h1>
      </div>
      <div className="min-w-0">
        <Hash value={address} full hashClassName="text-xl font-semibold text-foreground" />
      </div>
      {nonce !== undefined ? (
        <p className="text-xs text-muted-foreground">
          nonce <Mono className="text-foreground">{formatInteger(nonce)}</Mono>
        </p>
      ) : null}
      {data.errors.length > 0 ? (
        <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <ul className="list-inside list-disc">
            {data.errors.slice(0, 3).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}

// ---------- Stats strip ----------

function StatsStrip({ data }: { data: PerpetualHubUserDetail }) {
  const c = data.current;
  const positions = c?.positions.length ?? 0;
  const orders = c?.pendingOrders.length ?? 0;
  // accounting fields are human-readable USD; current.* fields are raw on-chain
  // scaled values. Prefer accounting where possible.
  const accounting = data.accounting as
    | { balance?: string }
    | undefined;
  const balance =
    num(accounting?.balance) ?? scaleMicro(num(c?.user?.balance));
  const available = scaleMicro(num(c?.availableBalance));
  const marginUsed = scaleMicro(num(c?.marginUsed));
  const upnl = scaleMicro(num(c?.unrealizedPnl));
  return (
    <section
      aria-label="Account state"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3"
    >
      <StatCard
        label="Balance"
        value={balance !== undefined ? formatUsdCompact(balance) : "—"}
      />
      <StatCard
        label="Available"
        value={available !== undefined ? formatUsdCompact(available) : "—"}
      />
      <StatCard
        label="Margin used"
        value={marginUsed !== undefined ? formatUsdCompact(marginUsed) : "—"}
      />
      <StatCard
        label="Unrealized PnL"
        value={upnl !== undefined ? signedUsd(upnl) : "—"}
        tone={upnl !== undefined ? (upnl > 0 ? "success" : upnl < 0 ? "danger" : "default") : "default"}
      />
      <StatCard label="Positions" value={formatInteger(positions)} sublabel="open" />
      <StatCard label="Orders" value={formatInteger(orders)} sublabel="pending" />
    </section>
  );
}

// ---------- Positions tab ----------

function PositionsTab({ positions }: { positions: PerpetualHubUserPosition[] }) {
  return (
    <SectionCard title="Open positions">
      {positions.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no open positions
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-mono font-medium">Symbol</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Side</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Quantity</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Entry</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Mark</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Notional</th>
                <th className="px-3 py-2 text-right font-mono font-medium">uPnL</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Lev</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Liq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {positions.map((p, i) => (
                <tr key={`${p.symbol ?? "?"}-${i}`}>
                  <td className="px-3 py-2 font-mono text-foreground">{p.symbol ?? "—"}</td>
                  <td className="px-3 py-2">
                    {p.side ? <SideTag side={p.side} /> : <Mono className="text-muted-foreground">—</Mono>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {p.quantity ?? p.positionAmt ? formatNumber(p.quantity ?? p.positionAmt!, 4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {p.entryPrice ? formatNumber(p.entryPrice, 6) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {p.markPrice ? formatNumber(p.markPrice, 6) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {p.notional ? formatUsdCompact(num(p.notional)) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PnlValue value={p.unrealizedPnl} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {p.leverage !== undefined ? `${p.leverage}×` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-destructive">
                    {p.liquidationPrice ? formatNumber(p.liquidationPrice, 6) : "—"}
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

// ---------- Orders tab ----------

function OrdersTab({ orders }: { orders: PerpetualHubUserOrder[] }) {
  return (
    <SectionCard title="Pending orders">
      {orders.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no pending orders
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-mono font-medium">Order</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Symbol</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Side</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Type</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Quantity</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Price</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Stop</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o, i) => (
                <tr key={`${o.orderId ?? o.id ?? i}`}>
                  <td className="px-3 py-2 font-mono text-foreground">
                    {o.orderId ?? o.id ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-foreground">{o.symbol ?? "—"}</td>
                  <td className="px-3 py-2">
                    {o.side ? <SideTag side={o.side} /> : <Mono className="text-muted-foreground">—</Mono>}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{o.orderType ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {o.quantity ? formatNumber(o.quantity, 4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {o.price ? formatNumber(o.price, 6) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {o.stopPrice ? formatNumber(o.stopPrice, 6) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {o.status ? <StatusBadge status={o.status} /> : <Mono className="text-muted-foreground">—</Mono>}
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

// ---------- Activity tab ----------

function ActivityTab({
  events,
  total,
}: {
  events: PerpetualHubOperation[];
  total: number;
}) {
  return (
    <SectionCard
      title={`Activity${total ? ` (${formatInteger(total)})` : ""}`}
      hint={total > events.length ? `showing ${events.length} most recent` : undefined}
    >
      {events.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no activity
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((op, i) => (
            <ActivityRow key={`${op.teeSequence ?? "noseq"}-${op.id ?? i}`} op={op} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ActivityRow({ op }: { op: PerpetualHubOperation }) {
  const seq = op.teeSequence;
  const href = seq !== undefined ? ROUTES.EXPLORER.BLOCK(seq) : undefined;
  const inner = (
    <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,7rem)_auto_auto]">
      <Mono className="text-sm text-foreground group-hover:text-primary">
        {seq !== undefined ? formatId(seq) : "—"}
      </Mono>
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
      <StatusBadge status={op.status} />
      <RelativeTime timestamp={op.timestamp} className="text-xs" />
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

// ---------- Trades tab ----------

function TradesTab({ trades, total }: { trades: PerpetualHubTrade[]; total: number }) {
  return (
    <SectionCard
      title={`Trades${total ? ` (${formatInteger(total)})` : ""}`}
      hint={total > trades.length ? `showing ${trades.length} most recent` : undefined}
    >
      {trades.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no trades
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-mono font-medium">Time</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Symbol</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Side</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Quantity</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Price</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Fee</th>
                <th className="px-3 py-2 text-right font-mono font-medium">Realized PnL</th>
                <th className="px-3 py-2 text-left font-mono font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trades.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    <RelativeTime timestamp={t.timestamp} className="text-xs" />
                  </td>
                  <td className="px-3 py-2 font-mono text-foreground">{t.symbol ?? "—"}</td>
                  <td className="px-3 py-2">
                    {t.side ? <SideTag side={t.side} /> : <Mono className="text-muted-foreground">—</Mono>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {t.quantity ? formatNumber(t.quantity, 4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {t.price ? formatNumber(t.price, 6) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {t.fee ? formatNumber(t.fee, 6) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PnlValue value={t.realizedPnl} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                    {t.isClose ? "close" : "open"}
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

// ---------- Accounting tab ----------

function AccountingTab({ data }: { data: PerpetualHubUserDetail }) {
  const a = data.accounting;
  if (!a) {
    return (
      <SectionCard title="Accounting">
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          no accounting data for this address
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Accounting totals">
      <DataRow label="Deposits">
        <Mono className="text-foreground">
          {a.totalDeposits ? formatUsdCompact(num(a.totalDeposits)) : "—"}
        </Mono>
      </DataRow>
      <DataRow label="Withdrawals">
        <Mono className="text-foreground">
          {a.totalWithdrawals ? formatUsdCompact(num(a.totalWithdrawals)) : "—"}
        </Mono>
      </DataRow>
      <DataRow label="Commission paid">
        <Mono className="text-muted-foreground">
          {a.totalCommissionPaid ? formatUsdCompact(num(a.totalCommissionPaid)) : "—"}
        </Mono>
      </DataRow>
      <DataRow label="Funding paid">
        <Mono className="text-muted-foreground">
          {a.totalFundingPaid ? formatUsdCompact(num(a.totalFundingPaid)) : "—"}
        </Mono>
      </DataRow>
      <DataRow label="Realized PnL">
        <PnlValue value={a.realizedPnl} compact />
      </DataRow>
    </SectionCard>
  );
}

// ---------- Skeleton ----------

function AddressSkeleton({ address }: { address: string }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Address
        </p>
        <p className="break-all font-mono text-xl font-semibold text-foreground">{address}</p>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="block h-16 animate-pulse rounded-md bg-muted/30" />
        ))}
      </div>
      <span className="block h-9 w-full max-w-md animate-pulse rounded-md bg-muted/30" />
      <span className="block h-72 w-full animate-pulse rounded-md bg-muted/30" />
    </div>
  );
}

// ---------- Shared ----------

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
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
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3 px-3 py-2 text-sm sm:grid-cols-[10rem_1fr]">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function SideTag({ side }: { side: string }) {
  const s = side.toLowerCase();
  const isBuy = s.includes("buy") || s.includes("long");
  const isSell = s.includes("sell") || s.includes("short");
  const tone = isBuy
    ? "bg-[var(--explorer-success)]/15 text-[var(--explorer-success)]"
    : isSell
    ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase ${tone}`}
    >
      {side}
    </span>
  );
}

function PnlValue({
  value,
  compact = false,
}: {
  value: string | undefined;
  compact?: boolean;
}) {
  if (value === undefined || value === null) {
    return <Mono className="text-muted-foreground">—</Mono>;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return <Mono className="text-muted-foreground">—</Mono>;
  const tone =
    n > 0
      ? "text-[var(--explorer-success)]"
      : n < 0
      ? "text-destructive"
      : "text-foreground";
  const display = compact ? formatUsdCompact(n) : formatNumber(n, 6);
  return (
    <Mono className={tone}>
      {n > 0 ? "+" : ""}
      {display}
    </Mono>
  );
}

function num(v: string | number | undefined): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The perp hub stores balances/margins as integers in micro-USD (1e6 scaling).
 * `accounting.balance` is already human, but `current.*` fields aren't.
 * Apply when reading from `current.*`.
 */
function scaleMicro(v: number | undefined): number | undefined {
  if (v === undefined) return undefined;
  return v / 1e6;
}

function signedUsd(n: number): string {
  return (n > 0 ? "+" : "") + formatUsdCompact(n);
}
