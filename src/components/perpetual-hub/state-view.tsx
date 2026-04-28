"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CircleDollarSign,
  Database,
  Gauge,
  Users,
} from "lucide-react";
import { usePerpetualHubState } from "@/lib/perpetual-hub";
import { ROUTES } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { shortenAddress } from "@/lib/utils/utils";

function formatNumber(value?: number, decimals = 0) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function formatCompact(value?: number, decimals = 2) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(decimals)}K`;
  return `${sign}${formatNumber(abs, decimals)}`;
}

function formatUsd(value?: number) {
  return `$${formatCompact(value, 2)}`;
}

function truncate(value?: string, chars = 6) {
  if (!value) return "-";
  if (value.startsWith("0x") && value.length > 14) return shortenAddress(value, chars);
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-lg py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerpetualHubStateView({ seq }: { seq: string }) {
  const { data, isLoading, isError, error } = usePerpetualHubState(seq);

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Spinner size={28} className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading sequence state</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">
        <p className="font-semibold">Failed to load sequence state</p>
        <p className="mt-2 text-sm opacity-90">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 py-4 pb-16">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sequence #{formatNumber(data.sequenceNumber)}
            </h1>
            <Badge variant="outline" className="gap-1.5">
              <Database className="h-3.5 w-3.5" />
              {data.source || "state"}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {data.merkleRoot || "-"}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={ROUTES.PERPETUAL_HUB.ROOT}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Users" value={formatNumber(data.metrics.users)} icon={Users} />
        <MetricCard label="Open Positions" value={formatNumber(data.metrics.openPositions)} icon={BarChart3} />
        <MetricCard label="Pending Orders" value={formatNumber(data.metrics.pendingOrders)} icon={Gauge} />
        <MetricCard label="Open Interest" value={formatUsd(data.metrics.openInterest)} icon={CircleDollarSign} />
        <MetricCard label="User Balance" value={formatUsd(data.metrics.totalUserBalance)} icon={CircleDollarSign} />
        <MetricCard label="Platform Fees" value={formatUsd(data.metrics.platformFeesCollected)} icon={CircleDollarSign} />
        <MetricCard label="Hedger Deposits" value={formatUsd(data.metrics.hedgerTotalDeposits)} icon={CircleDollarSign} />
        <MetricCard label="Hedger PnL" value={formatUsd(data.metrics.hedgerRealizedPnl)} icon={Gauge} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-sm">Transition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-1">
              <span className="text-muted-foreground">Operation</span>
              <span className="font-medium">{data.transition?.opType || "-"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Rollup</span>
              <span className="font-mono">
                {data.transition?.rollupId ? `#${data.transition.rollupId}` : "-"}
              </span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Previous root</span>
              <span className="break-all font-mono">{data.transition?.prevRoot || "-"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">New root</span>
              <span className="break-all font-mono">{data.transition?.newRoot || data.merkleRoot || "-"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-lg py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Symbol</th>
                  <th className="px-4 py-3 text-right font-medium">Long OI</th>
                  <th className="px-4 py-3 text-right font-medium">Short OI</th>
                  <th className="px-4 py-3 text-right font-medium">Net Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Positions</th>
                </tr>
              </thead>
              <tbody>
                {data.exposureBySymbol.slice(0, 12).map((row) => (
                  <tr key={row.symbol} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.symbol}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-500">
                      {formatUsd(row.longNotional)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-destructive">
                      {formatUsd(row.shortNotional)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCompact(row.netQuantity, 4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{row.positions}</td>
                  </tr>
                ))}
                {!data.exposureBySymbol.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                      No open exposure
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-lg py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 text-right font-medium">Positions</th>
                <th className="px-4 py-3 text-right font-medium">Pending Orders</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.address} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-mono text-primary">
                    {truncate(user.address)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(user.balance)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {user.positions}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {user.pendingOrders}
                  </td>
                </tr>
              ))}
              {!data.users.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                    No users in this state
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
