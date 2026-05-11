"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import moment from "moment";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Database,
  ExternalLink,
  Gauge,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users as UsersIcon,
  Wallet,
  XCircle,
} from "lucide-react";
import { usePerpetualHubSummary, usePerpetualHubUsers } from "@/lib/perpetual-hub";
import { getPerpetualHubRollupByRoot } from "@/lib/perpetual-hub/api";
import type {
  PerpetualHubOperation,
  PerpetualHubHedgerPosition,
  PerpetualHubTrade,
  PerpetualHubUserBalance,
  PerpetualHubUserDetail,
  PerpetualHubUserOrder,
  PerpetualHubUserPosition,
} from "@/lib/perpetual-hub";
import { ROUTES } from "@/lib/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, shortenAddress } from "@/lib/utils/utils";

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

function formatUsd(value?: number, decimals = 2) {
  return `$${formatCompact(value, decimals)}`;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isIntegerString(value: unknown) {
  return typeof value === "string" && /^-?\d+$/.test(value);
}

function amountToUsd(value: unknown) {
  const amount = toNumber(value);
  if (!amount) return 0;
  return isIntegerString(value) ? amount / 1e6 : amount;
}

function quantityToUnits(value: unknown) {
  const quantity = toNumber(value);
  if (!quantity) return 0;
  return isIntegerString(value) ? quantity / 1e8 : quantity;
}

function priceToUsd(value: unknown) {
  const price = toNumber(value);
  if (!price) return 0;
  return isIntegerString(value) ? price / 1e18 : price;
}

function eventNotional(event: PerpetualHubOperation) {
  const amount = amountToUsd(event.amount);
  if (amount) return Math.abs(amount);
  const quantity = toNumber(event.quantity);
  const price = toNumber(event.price);
  const normalizedQuantity = isIntegerString(event.quantity)
    ? quantity / 1e8
    : quantity;
  const normalizedPrice = isIntegerString(event.price) ? price / 1e18 : price;
  return Math.abs(normalizedQuantity * normalizedPrice);
}

function eventDetails(event: PerpetualHubOperation) {
  const details: { label: string; value: string; tone?: "positive" | "danger" }[] = [];
  const quantity = quantityToUnits(event.quantity);
  const price = priceToUsd(event.price);
  const amount = amountToUsd(event.amount);
  const fee = amountToUsd(event.fee);
  const realizedPnl = amountToUsd(event.realizedPnl);

  if (event.operationType === "CHANGE_LEVERAGE" && event.amount) {
    details.push({ label: "Lev", value: `${event.amount}x` });
  }
  if (event.operationType === "CANCEL_ORDER" && event.amount) {
    details.push({ label: "Order", value: String(event.amount) });
  }
  if (amount && !["CHANGE_LEVERAGE", "CANCEL_ORDER"].includes(event.operationType)) {
    details.push({ label: "Amount", value: formatUsd(amount) });
  }
  if (quantity) {
    details.push({ label: "Qty", value: formatCompact(quantity, 4) });
  }
  if (price) {
    details.push({ label: "Price", value: formatUsd(price, 4) });
  }
  if (fee) {
    details.push({ label: "Fee", value: formatUsd(fee) });
  }
  if (event.realizedPnl) {
    details.push({
      label: "PnL",
      value: formatUsd(realizedPnl),
      tone: realizedPnl >= 0 ? "positive" : "danger",
    });
  }
  if (event.rejectReason) {
    details.push({ label: "Reject", value: event.rejectReason, tone: "danger" });
  }

  return details;
}

function formatPercent(value?: number) {
  return `${((value ?? 0) * 100).toFixed(1)}%`;
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return "Never";
  const milliseconds = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return moment(milliseconds).format("MMM D, HH:mm:ss");
}

function arbiscanTxUrl(txHash: string) {
  return `https://arbiscan.io/tx/${txHash}`;
}

function isUserAddress(value?: string) {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function truncate(value?: string, chars = 5) {
  if (!value) return "-";
  if (value.startsWith("0x") && value.length > 12) return shortenAddress(value, chars);
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function statusBadge(
  status: "ok" | "warn" | "bad" | "idle",
  label: string
) {
  const icon =
    status === "ok" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : status === "bad" ? (
      <XCircle className="h-3.5 w-3.5" />
    ) : status === "warn" ? (
      <AlertTriangle className="h-3.5 w-3.5" />
    ) : (
      <Clock className="h-3.5 w-3.5" />
    );

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        status === "ok" && "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
        status === "warn" && "border-amber-500/40 text-amber-500 bg-amber-500/10",
        status === "bad" && "border-destructive/50 text-destructive bg-destructive/10",
        status === "idle" && "text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "warning" | "danger" | "info";
  sub?: string;
}) {
  return (
    <Card className="gap-3 py-4 rounded-lg">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums tracking-normal",
                tone === "positive" && "text-emerald-500",
                tone === "warning" && "text-amber-500",
                tone === "danger" && "text-destructive",
                tone === "info" && "text-primary"
              )}
            >
              {value}
            </p>
            {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
          </div>
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function OperationTypeGrid({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No operation stats</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(([type, count]) => (
        <div key={type} className="rounded-lg border bg-card p-3">
          <p className="truncate text-xs text-muted-foreground">{type}</p>
          <p className="mt-1 font-mono text-lg font-semibold">{formatNumber(count)}</p>
        </div>
      ))}
    </div>
  );
}

function ExposureTable({
  rows,
}: {
  rows: {
    symbol: string;
    longNotional: number;
    shortNotional: number;
    netQuantity: number;
    positions: number;
  }[];
}) {
  if (!rows.length) {
    return (
      <Card className="rounded-lg py-8">
        <CardContent className="text-center text-sm text-muted-foreground">
          No open exposure
        </CardContent>
      </Card>
    );
  }

  return (
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
            {rows.slice(0, 8).map((row) => (
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
                <td className="px-4 py-3 text-right font-mono">
                  {row.positions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function HedgerPositionsTable({
  positions,
}: {
  positions: PerpetualHubHedgerPosition[];
}) {
  if (!positions.length) {
    return (
      <Card className="rounded-lg py-8">
        <CardContent className="text-center text-sm text-muted-foreground">
          No open hedger positions
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-lg py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Symbol</th>
              <th className="px-4 py-3 text-left font-medium">Side</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-right font-medium">Entry</th>
              <th className="px-4 py-3 text-right font-medium">Notional</th>
              <th className="px-4 py-3 text-right font-medium">Initial Margin</th>
              <th className="px-4 py-3 text-right font-medium">Maint Margin</th>
              <th className="px-4 py-3 text-right font-medium">PnL</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => {
              const amount = toNumber(position.positionAmt);
              const pnl = toNumber(position.unrealizedProfit);
              return (
                <tr key={position.symbol} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{position.symbol}</td>
                  <td className="px-4 py-3">
                    {amount > 0
                      ? statusBadge("ok", "Long")
                      : amount < 0
                        ? statusBadge("bad", "Short")
                        : statusBadge("idle", position.positionSide || "-")}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      amount > 0 && "text-emerald-500",
                      amount < 0 && "text-destructive"
                    )}
                  >
                    {formatCompact(amount, 6)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(toNumber(position.entryPrice), 4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(Math.abs(toNumber(position.notional)))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(toNumber(position.initialMargin))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(toNumber(position.maintMargin))}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      pnl > 0 && "text-emerald-500",
                      pnl < 0 && "text-destructive"
                    )}
                  >
                    {formatUsd(pnl)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatTimestamp(position.updateTime)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RecentEventsTable({
  events,
  emptyLabel = "No recent events",
  showRollupColumns = false,
}: {
  events: PerpetualHubOperation[];
  emptyLabel?: string;
  showRollupColumns?: boolean;
}) {
  if (!events.length) {
    return (
      <Card className="rounded-lg py-8">
        <CardContent className="text-center text-sm text-muted-foreground">
          {emptyLabel}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-lg py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Time</th>
              <th className="px-4 py-3 text-right font-medium">SeqNo</th>
              {showRollupColumns && (
                <th className="px-4 py-3 text-right font-medium">RollupID</th>
              )}
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Symbol</th>
              <th className="px-4 py-3 text-right font-medium">Notional</th>
              <th className="px-4 py-3 text-left font-medium">Details</th>
              {showRollupColumns && (
                <th className="px-4 py-3 text-left font-medium">Tx</th>
              )}
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 12).map((event) => {
              const details = eventDetails(event);
              return (
                <tr key={event.id} className="border-b last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {event.teeSequence ? (
                      <Link
                        href={ROUTES.PERPETUAL_HUB.STATE(event.teeSequence)}
                        className="text-primary hover:underline"
                      >
                        #{formatNumber(event.teeSequence)}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  {showRollupColumns && (
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {event.rollupId ? (
                        <Link
                          href={ROUTES.PERPETUAL_HUB.ROLLUP(event.rollupId)}
                          className="text-primary hover:underline"
                        >
                          #{event.rollupId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Badge variant="outline">{event.operationType}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {isUserAddress(event.userAddress) ? (
                      <Link
                        href={ROUTES.PERPETUAL_HUB.USER(event.userAddress)}
                        className="text-primary hover:underline"
                      >
                        {truncate(event.userAddress)}
                      </Link>
                    ) : (
                      truncate(event.userAddress)
                    )}
                  </td>
                  <td className="px-4 py-3">{event.symbol || "-"}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(eventNotional(event))}
                  </td>
                  <td className="max-w-[360px] px-4 py-3">
                    {details.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {details.map((detail) => (
                          <Badge
                            key={`${detail.label}-${detail.value}`}
                            variant="outline"
                            className={cn(
                              "max-w-full gap-1 font-mono text-xs",
                              detail.tone === "positive" &&
                                "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
                              detail.tone === "danger" &&
                                "border-destructive/50 text-destructive bg-destructive/10"
                            )}
                          >
                            <span className="text-muted-foreground">{detail.label}</span>
                            <span className="truncate">{detail.value}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  {showRollupColumns && (
                    <td className="px-4 py-3 font-mono">
                      {event.rollupTxHash ? (
                        <a
                          href={arbiscanTxUrl(event.rollupTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {truncate(event.rollupTxHash, 4)}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {event.status === "SUCCESS"
                      ? statusBadge("ok", "Success")
                      : statusBadge("bad", event.status || "Rejected")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function userPositionQuantity(position: PerpetualHubUserPosition) {
  return quantityToUnits(position.positionAmt ?? position.quantity);
}

function userPositionNotional(position: PerpetualHubUserPosition) {
  const explicit = Math.abs(amountToUsd(position.notional));
  if (explicit) return explicit;
  return Math.abs(userPositionQuantity(position)) * Math.abs(priceToUsd(position.entryPrice));
}

function UserPositionsTable({ positions }: { positions: PerpetualHubUserPosition[] }) {
  if (!positions.length) return null;

  return (
    <Card className="overflow-hidden rounded-lg py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Symbol</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
              <th className="px-4 py-3 text-right font-medium">Entry</th>
              <th className="px-4 py-3 text-right font-medium">Mark</th>
              <th className="px-4 py-3 text-right font-medium">Notional</th>
              <th className="px-4 py-3 text-right font-medium">PnL</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => {
              const quantity = userPositionQuantity(position);
              const pnl = amountToUsd(position.unrealizedPnl);
              return (
                <tr
                  key={`${position.symbol ?? "position"}-${index}`}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-3 font-medium">{position.symbol || "-"}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      quantity > 0 && "text-emerald-500",
                      quantity < 0 && "text-destructive"
                    )}
                  >
                    {formatCompact(quantity, 4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(priceToUsd(position.entryPrice))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {position.markPrice ? formatUsd(priceToUsd(position.markPrice)) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(userPositionNotional(position))}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      pnl > 0 && "text-emerald-500",
                      pnl < 0 && "text-destructive"
                    )}
                  >
                    {position.unrealizedPnl ? formatUsd(pnl) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UserOrdersTable({ orders }: { orders: PerpetualHubUserOrder[] }) {
  if (!orders.length) return null;

  return (
    <Card className="overflow-hidden rounded-lg py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Order</th>
              <th className="px-4 py-3 text-left font-medium">Symbol</th>
              <th className="px-4 py-3 text-left font-medium">Side</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 8).map((order, index) => (
              <tr
                key={`${order.orderId ?? order.id ?? "order"}-${index}`}
                className="border-b last:border-b-0"
              >
                <td className="px-4 py-3 font-mono">
                  {order.orderId ?? order.id ?? "-"}
                </td>
                <td className="px-4 py-3">{order.symbol || "-"}</td>
                <td className="px-4 py-3">{order.side || "-"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCompact(quantityToUnits(order.quantity), 4)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatUsd(priceToUsd(order.price))}
                </td>
                <td className="px-4 py-3">{order.status || order.orderType || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UserTradesTable({ trades }: { trades: PerpetualHubTrade[] }) {
  if (!trades.length) return null;

  return (
    <Card className="overflow-hidden rounded-lg py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Time</th>
              <th className="px-4 py-3 text-left font-medium">Symbol</th>
              <th className="px-4 py-3 text-left font-medium">Side</th>
              <th className="px-4 py-3 text-right font-medium">Quantity</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Mode</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 8).map((trade) => (
              <tr key={trade.id} className="border-b last:border-b-0">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatTimestamp(trade.timestamp)}
                </td>
                <td className="px-4 py-3">{trade.symbol || "-"}</td>
                <td className="px-4 py-3">{trade.side || "-"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCompact(quantityToUnits(trade.quantity), 4)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatUsd(priceToUsd(trade.price))}
                </td>
                <td className="px-4 py-3">
                  {trade.isClose ? statusBadge("warn", "Close") : statusBadge("ok", "Open")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type UserBalanceSortKey =
  | "address"
  | "wallet"
  | "available"
  | "marginUsed"
  | "maintenanceMargin"
  | "marginBalance"
  | "unrealizedPnl"
  | "positions"
  | "orders";

const USER_BALANCE_COLUMNS: {
  key: UserBalanceSortKey;
  label: string;
  align?: "left" | "right";
}[] = [
  { key: "address", label: "Address", align: "left" },
  { key: "wallet", label: "Wallet", align: "right" },
  { key: "available", label: "Available", align: "right" },
  { key: "marginUsed", label: "Margin Used", align: "right" },
  { key: "maintenanceMargin", label: "Maint. Margin", align: "right" },
  { key: "marginBalance", label: "Margin Balance", align: "right" },
  { key: "unrealizedPnl", label: "Unrealized PnL", align: "right" },
  { key: "positions", label: "Positions", align: "right" },
  { key: "orders", label: "Orders", align: "right" },
];

function UserBalancesTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  emptyLabel = "No funded users at this sequence.",
}: {
  rows: PerpetualHubUserBalance[];
  sortKey: UserBalanceSortKey;
  sortDir: "asc" | "desc";
  onSort: (key: UserBalanceSortKey) => void;
  emptyLabel?: string;
}) {
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (!a.ok && !b.ok) return 0;
      if (!a.ok) return 1;
      if (!b.ok) return -1;
      if (sortKey === "address") {
        return sortDir === "asc"
          ? a.address.localeCompare(b.address)
          : b.address.localeCompare(a.address);
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  if (!rows.length) {
    return (
      <Card className="rounded-lg py-8">
        <CardContent className="text-center text-sm text-muted-foreground">
          {emptyLabel}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-lg py-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
            <tr>
              {USER_BALANCE_COLUMNS.map((column) => {
                const active = column.key === sortKey;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      "px-4 py-3 font-medium",
                      column.align === "right" ? "text-right" : "text-left"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground",
                        column.align === "right" && "ml-auto",
                        active && "text-primary"
                      )}
                    >
                      {column.label}
                      {active &&
                        (sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        ))}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              if (!row.ok) {
                return (
                  <tr key={row.address} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-mono">
                      <Link
                        href={ROUTES.PERPETUAL_HUB.USER(row.address)}
                        className="text-primary hover:underline"
                      >
                        {truncate(row.address, 6)}
                      </Link>
                    </td>
                    <td colSpan={8} className="px-4 py-3 text-destructive">
                      Failed: {row.error}
                    </td>
                  </tr>
                );
              }
              const upnlTone =
                row.unrealizedPnl > 0
                  ? "text-emerald-500"
                  : row.unrealizedPnl < 0
                    ? "text-destructive"
                    : "text-muted-foreground";
              return (
                <tr key={row.address} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-mono">
                    <Link
                      href={ROUTES.PERPETUAL_HUB.USER(row.address)}
                      className="text-primary hover:underline"
                      title={row.address}
                    >
                      {truncate(row.address, 6)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(row.wallet)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(row.available)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      row.marginUsed === 0 && "text-muted-foreground"
                    )}
                  >
                    {formatUsd(row.marginUsed)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      row.maintenanceMargin === 0 && "text-muted-foreground"
                    )}
                  >
                    {formatUsd(row.maintenanceMargin)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatUsd(row.marginBalance)}
                  </td>
                  <td className={cn("px-4 py-3 text-right font-mono", upnlTone)}>
                    {formatUsd(row.unrealizedPnl)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      row.positions === 0 && "text-muted-foreground"
                    )}
                  >
                    {formatNumber(row.positions)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono",
                      row.orders === 0 && "text-muted-foreground"
                    )}
                  >
                    {formatNumber(row.orders)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UsersTabContent() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    usePerpetualHubUsers();
  const [sortKey, setSortKey] = useState<UserBalanceSortKey>("marginBalance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  function handleSort(key: UserBalanceSortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "address" ? "asc" : "desc");
    }
  }

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const term = filter.trim().toLowerCase();
    if (!term) return data.users;
    return data.users.filter((row) => row.address.toLowerCase().includes(term));
  }, [data, filter]);

  if (isLoading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
        <Spinner size={24} className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading user balances</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="rounded-lg border-destructive/40 bg-destructive/5 py-4">
        <CardContent className="px-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load user balances"}
        </CardContent>
      </Card>
    );
  }

  const userCountSub =
    data.hiddenEmpty > 0
      ? `${data.fundedUsers} / ${data.totalUsers} (${data.hiddenEmpty} empty hidden)`
      : `${data.fundedUsers} total`;
  const filterTerm = filter.trim();
  const filterMatches = filterTerm ? filteredRows.length : null;

  return (
    <Section title="User Balances" icon={UsersIcon}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Snapshot of every user from the latest on-chain state. Updated{" "}
          {moment(data.updatedAt).format("HH:mm:ss")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Spinner size={14} /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by address"
            className="pl-9 font-mono"
          />
        </div>
        {filterMatches != null && (
          <p className="text-xs text-muted-foreground">
            {formatNumber(filterMatches)} of {formatNumber(data.users.length)} users
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="On-Chain Seq"
          value={`#${formatNumber(data.onChainSeq)}`}
          icon={Database}
          tone="info"
          sub={data.teeSeq != null ? `TEE #${formatNumber(data.teeSeq)}` : undefined}
        />
        <MetricCard
          label="Funded Users"
          value={formatNumber(data.fundedUsers)}
          icon={UsersIcon}
          sub={userCountSub}
        />
        <MetricCard
          label="Pending Ops"
          value={formatNumber(data.pendingOps ?? 0)}
          icon={Clock}
          tone={(data.pendingOps ?? 0) > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Total Wallet"
          value={formatUsd(data.totals.wallet)}
          icon={Wallet}
          tone="positive"
        />
        <MetricCard
          label="Total Margin Balance"
          value={formatUsd(data.totals.marginBalance)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Total Unrealized PnL"
          value={formatUsd(data.totals.unrealizedPnl)}
          icon={TrendingUp}
          tone={data.totals.unrealizedPnl >= 0 ? "positive" : "danger"}
        />
      </div>

      <UserBalancesTable
        rows={filteredRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        emptyLabel={
          filterTerm
            ? "No users match this filter."
            : "No funded users at this sequence."
        }
      />
    </Section>
  );
}

export function UserLookupResults({ data }: { data: PerpetualHubUserDetail }) {
  const current = data.current;
  const address = current?.user?.address ?? data.address;
  const positions = current?.positions ?? [];
  const pendingOrders = current?.pendingOrders ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {truncate(address, 6)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Updated {moment(data.updatedAt).format("HH:mm:ss")}
        </span>
        {data.errors.map((item) => (
          <Badge key={item} variant="outline" className="text-amber-500">
            {item}
          </Badge>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Balance"
          value={formatUsd(amountToUsd(current?.user?.balance))}
          icon={Wallet}
          tone="info"
        />
        <MetricCard
          label="Available"
          value={formatUsd(amountToUsd(current?.availableBalance))}
          icon={CircleDollarSign}
          tone="positive"
        />
        <MetricCard
          label="Unrealized PnL"
          value={formatUsd(amountToUsd(current?.unrealizedPnl))}
          icon={TrendingUp}
          tone={amountToUsd(current?.unrealizedPnl) >= 0 ? "positive" : "danger"}
        />
        <MetricCard
          label="Realized PnL"
          value={formatUsd(amountToUsd(data.accounting?.realizedPnl))}
          icon={TrendingUp}
          tone={amountToUsd(data.accounting?.realizedPnl) >= 0 ? "positive" : "danger"}
        />
        <MetricCard
          label="Margin Used"
          value={formatUsd(amountToUsd(current?.marginUsed))}
          icon={Gauge}
        />
        <MetricCard
          label="Positions"
          value={formatNumber(positions.length)}
          icon={BarChart3}
        />
        <MetricCard
          label="Pending Orders"
          value={formatNumber(pendingOrders.length)}
          icon={Clock}
          tone={pendingOrders.length ? "warning" : "default"}
        />
        <MetricCard
          label="History Events"
          value={formatNumber(data.history.totalEvents)}
          icon={Activity}
        />
        <MetricCard
          label="Trades"
          value={formatNumber(data.history.totalTrades)}
          icon={TrendingUp}
        />
      </div>

      <UserPositionsTable positions={positions} />
      <UserOrdersTable orders={pendingOrders} />

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Transactions"
          value={formatNumber(data.history.totalTransactions)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Latest Sample"
          value={formatNumber(data.history.events.length)}
          icon={Database}
          sub="visible user events"
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Recent User Events
        </h3>
        <RecentEventsTable
          events={data.history.events}
          emptyLabel="No user events"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Trades
          </h3>
          <UserTradesTable trades={data.history.trades} />
          {!data.history.trades.length && (
            <Card className="rounded-lg py-8">
              <CardContent className="text-center text-sm text-muted-foreground">
                No trades
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Transactions
          </h3>
          <RecentEventsTable
            events={data.history.transactions}
            emptyLabel="No transactions"
          />
        </div>
      </div>
    </div>
  );
}

type RollupListItem = {
  id: number;
  txHash?: string;
  status: string;
  operationsCount: number;
  submittedAt: number;
  oldSequence: number;
  newSequence: number;
};

function RollupList({
  latest,
}: {
  latest: RollupListItem[];
}) {
  if (!latest.length) {
    return (
      <Card className="rounded-lg py-8">
        <CardContent className="text-center text-sm text-muted-foreground">
          No rollups
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {latest.map((rollup) => (
        <div
          key={rollup.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={ROUTES.PERPETUAL_HUB.ROLLUP(rollup.id)}
                className="font-mono text-sm text-primary hover:underline"
              >
                #{rollup.id}
              </Link>
              {statusBadge(
                rollup.status === "CONFIRMED" ? "ok" : rollup.status === "FAILED" ? "bad" : "warn",
                rollup.status
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Seq{" "}
              <Link
                href={ROUTES.PERPETUAL_HUB.STATE(rollup.oldSequence)}
                className="font-mono text-primary hover:underline"
              >
                #{rollup.oldSequence}
              </Link>{" "}
              to{" "}
              <Link
                href={ROUTES.PERPETUAL_HUB.STATE(rollup.newSequence)}
                className="font-mono text-primary hover:underline"
              >
                #{rollup.newSequence}
              </Link>{" "}
              · {rollup.operationsCount} ops
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-mono text-primary">{truncate(rollup.txHash)}</p>
            <p className="mt-1 text-muted-foreground">
              {formatTimestamp(rollup.submittedAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectionNotice({
  backendUrl,
  errors,
}: {
  backendUrl: string;
  errors: string[];
}) {
  if (!errors.length) return null;

  const backendDown = errors.some((item) => item.startsWith("Backend"));

  return (
    <Card
      className={cn(
        "rounded-lg py-4",
        backendDown
          ? "border-destructive/35 bg-destructive/5"
          : "border-amber-500/35 bg-amber-500/5"
      )}
    >
      <CardContent className="px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 rounded-md p-2",
                backendDown
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-500"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {backendDown
                  ? "Waiting for Perpetual Hub API"
                  : "Perpetual Hub data is partially available"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The dashboard uses the backend API only, including reflected
                TEE state.
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs lg:min-w-[320px]">
            <div className="rounded-md border bg-background/50 px-3 py-2">
              <span className="text-muted-foreground">API</span>
              <p className="mt-1 truncate font-mono">{backendUrl}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {errors.slice(0, 4).map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="border-border bg-background/50 text-muted-foreground"
            >
              {item.replace(": fetch failed", " unreachable")}
            </Badge>
          ))}
          {errors.length > 4 && (
            <Badge variant="outline" className="text-muted-foreground">
              +{errors.length - 4} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PerpetualHubDashboard() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isFetching } =
    usePerpetualHubSummary();
  // Prefetch in parallel with the summary so the Users tab is instant on click.
  usePerpetualHubUsers();
  const [activeTab, setActiveTab] = useState("overview");
  const [rollupLookup, setRollupLookup] = useState("");
  const [seqLookup, setSeqLookup] = useState("");
  const [rootLookup, setRootLookup] = useState("");
  const [rootLookupError, setRootLookupError] = useState("");
  const [isRootLookupLoading, setIsRootLookupLoading] = useState(false);

  const healthStatus = useMemo(() => {
    if (!data) return statusBadge("idle", "Unknown");
    if (!data.health.backendStatus) {
      return statusBadge("bad", "Offline");
    }
    if (data.health.errors.length) return statusBadge("warn", "Partial");
    if (data.health.backendStatus === "healthy") {
      return statusBadge("ok", "Online");
    }
    return statusBadge("warn", "Degraded");
  }, [data]);

  const syncStatus = useMemo(() => {
    if (!data) return null;
    if (data.sync.rootsMatch === true) {
      return statusBadge("ok", "Roots match");
    }
    if (data.sync.rootsMatch === false) {
      if (data.sync.sequenceGap > 0 || data.sync.pendingOps > 0) {
        return statusBadge("warn", "Pending rollup");
      }
      return statusBadge("bad", "Roots differ");
    }
    return null;
  }, [data]);

  function normalizedLookup(value: string) {
    return value.trim().replace(/^#/, "");
  }

  function handleRollupLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = normalizedLookup(rollupLookup);
    if (/^\d+$/.test(id)) {
      router.push(ROUTES.PERPETUAL_HUB.ROLLUP(id));
    }
  }

  function handleSeqLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seq = normalizedLookup(seqLookup);
    if (/^\d+$/.test(seq)) {
      router.push(ROUTES.PERPETUAL_HUB.STATE(seq));
    }
  }

  async function handleRootLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const root = rootLookup.trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(root)) {
      setRootLookupError("Enter a valid 0x state root");
      return;
    }

    setRootLookupError("");
    setIsRootLookupLoading(true);
    try {
      const result = await getPerpetualHubRollupByRoot(root);
      router.push(ROUTES.PERPETUAL_HUB.ROLLUP(result.rollup.id));
    } catch (error) {
      setRootLookupError(
        error instanceof Error ? error.message : "Rollup root not found"
      );
    } finally {
      setIsRootLookupLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Spinner size={28} className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading Perpetual Hub</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">
        <p className="font-semibold">Failed to load Perpetual Hub</p>
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
              Perpetual Hub
            </h1>
            {healthStatus}
            {syncStatus}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Updated {moment(data.updatedAt).format("HH:mm:ss")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Spinner size={14} />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <ConnectionNotice
        backendUrl={data.source.backendUrl}
        errors={data.health.errors}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto w-fit max-w-full flex-wrap gap-1.5 rounded-lg border bg-muted/40 p-1.5">
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-2">
            <Gauge className="h-4 w-4" />
            Risk
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="hedger" className="gap-2">
            <Wallet className="h-4 w-4" />
            Hedger
          </TabsTrigger>
          <TabsTrigger value="rollups" className="gap-2">
            <Layers className="h-4 w-4" />
            Rollups
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          <Section title="System" icon={ShieldCheck}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="TEE Seq" value={`#${formatNumber(data.sync.teeSeq)}`} icon={Database} tone="info" />
              <MetricCard label="Chain Seq" value={`#${formatNumber(data.sync.chainSeq)}`} icon={Layers} />
              <MetricCard
                label="Pending Ops"
                value={formatNumber(data.sync.pendingOps)}
                icon={Clock}
                tone={data.sync.pendingOps > 0 ? "warning" : "positive"}
                sub={`Next rollup ${data.sync.nextRollupIn || 0}s`}
              />
              <MetricCard
                label="Proof Chain"
                value={data.proofs.chainValid === false ? "Broken" : "Valid"}
                icon={ShieldCheck}
                tone={data.proofs.chainValid === false ? "danger" : "positive"}
                sub={`${formatNumber(data.proofs.totalProofs)} proofs`}
              />
            </div>
          </Section>

          <Section title="Activity" icon={Activity}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Total Events" value={formatNumber(data.activity.totalEvents)} icon={Activity} />
              <MetricCard label="Success" value={formatNumber(data.activity.successEvents)} icon={CheckCircle2} tone="positive" />
              <MetricCard label="Rejected" value={formatNumber(data.activity.rejectedEvents)} icon={XCircle} tone={data.activity.rejectedEvents ? "danger" : "default"} />
              <MetricCard label="Reject Rate" value={formatPercent(data.activity.rejectRate)} icon={Gauge} tone={data.activity.rejectRate > 0.05 ? "warning" : "default"} />
              <MetricCard label="Recent Notional" value={formatUsd(data.volume.recentNotional)} icon={TrendingUp} sub="latest 100 events" />
            </div>
            <OperationTypeGrid data={data.activity.byType} />
          </Section>
        </TabsContent>

        <TabsContent value="risk" className="mt-0 space-y-6">
          <Section title="Risk" icon={Gauge}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Users" value={formatNumber(data.risk.users)} icon={Wallet} />
              <MetricCard label="Open Positions" value={formatNumber(data.risk.openPositions)} icon={BarChart3} />
              <MetricCard label="Open Interest" value={formatUsd(data.risk.openInterest)} icon={TrendingUp} tone="info" />
              <MetricCard
                label="Near Liquidation"
                value={formatNumber(data.risk.nearLiquidationCount)}
                icon={AlertTriangle}
                tone={data.risk.nearLiquidationCount ? "danger" : "default"}
              />
              <MetricCard label="User Balance" value={formatUsd(data.risk.totalUserBalance)} icon={CircleDollarSign} />
              <MetricCard label="Available" value={formatUsd(data.risk.totalAvailableBalance)} icon={Wallet} tone="positive" />
              <MetricCard
                label="Unrealized PnL"
                value={formatUsd(data.risk.totalUnrealizedPnl)}
                icon={TrendingUp}
                tone={data.risk.totalUnrealizedPnl >= 0 ? "positive" : "danger"}
              />
              <MetricCard label="Platform Fees" value={formatUsd(data.risk.platformFeesCollected)} icon={CircleDollarSign} />
            </div>
            <ExposureTable rows={data.risk.exposureBySymbol} />
          </Section>
        </TabsContent>

        <TabsContent value="users" className="mt-0 space-y-6">
          <UsersTabContent />
        </TabsContent>

        <TabsContent value="hedger" className="mt-0 space-y-6">
          <Section title="Hedger" icon={Wallet}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="Connection"
                value={data.hedger.connected === false ? "Down" : data.hedger.connected ? "Online" : "Unknown"}
                icon={ShieldCheck}
                tone={data.hedger.connected === false ? "danger" : data.hedger.connected ? "positive" : "warning"}
                sub={data.hedger.dryRun ? "Dry run" : data.hedger.error}
              />
              <MetricCard label="Available" value={formatUsd(data.hedger.availableBalance)} icon={Wallet} tone="positive" />
              <MetricCard label="Margin Balance" value={formatUsd(data.hedger.marginBalance)} icon={CircleDollarSign} />
              <MetricCard
                label="Unrealized PnL"
                value={formatUsd(data.hedger.unrealizedPnl)}
                icon={TrendingUp}
                tone={(data.hedger.unrealizedPnl ?? 0) >= 0 ? "positive" : "danger"}
              />
              <MetricCard label="Positions" value={formatNumber(data.hedger.openPositions)} icon={BarChart3} />
              <MetricCard label="Position Notional" value={formatUsd(data.hedger.positionNotional)} icon={Gauge} />
            </div>
            <HedgerPositionsTable positions={data.hedger.positions} />
          </Section>
        </TabsContent>

        <TabsContent value="rollups" className="mt-0 space-y-6">
          <Section title="Rollups" icon={Layers}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total Rollups" value={formatNumber(data.rollups.totalRollups)} icon={Layers} />
              <MetricCard label="Avg Ops" value={formatNumber(data.rollups.avgOpsPerRollup, 1)} icon={Activity} />
              <MetricCard label="Latest Seq" value={`#${formatNumber(data.rollups.latestSequence)}`} icon={Database} tone="info" />
              <MetricCard label="Total Ops" value={formatNumber(data.rollups.totalOps)} icon={Activity} />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <form onSubmit={handleRollupLookup} className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    inputMode="numeric"
                    pattern="[0-9#]*"
                    value={rollupLookup}
                    onChange={(event) => setRollupLookup(event.target.value)}
                    placeholder="Go to rollup ID"
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="outline">
                  Open
                </Button>
              </form>
              <form onSubmit={handleSeqLookup} className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Database className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    inputMode="numeric"
                    pattern="[0-9#]*"
                    value={seqLookup}
                    onChange={(event) => setSeqLookup(event.target.value)}
                    placeholder="Go to SeqNo"
                    className="pl-9"
                  />
                </div>
                <Button type="submit" variant="outline">
                  Open
                </Button>
              </form>
              <form onSubmit={handleRootLookup} className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={rootLookup}
                    onChange={(event) => {
                      setRootLookup(event.target.value);
                      if (rootLookupError) setRootLookupError("");
                    }}
                    placeholder="Go to new root"
                    className="pl-9 font-mono"
                  />
                </div>
                <Button type="submit" variant="outline" disabled={isRootLookupLoading}>
                  {isRootLookupLoading ? <Spinner size={14} /> : "Open"}
                </Button>
              </form>
            </div>
            {rootLookupError && (
              <p className="text-sm text-destructive">{rootLookupError}</p>
            )}
            <RollupList latest={data.rollups.latest} />
          </Section>
        </TabsContent>

        <TabsContent value="events" className="mt-0 space-y-6">
          <Section title="Recent Events" icon={ExternalLink}>
            <RecentEventsTable events={data.activity.recentEvents} showRollupColumns />
          </Section>

          {data.activity.topRejectReasons.length > 0 && (
            <Section title="Reject Reasons" icon={AlertTriangle}>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {data.activity.topRejectReasons.map((item) => (
                  <Card key={item.reason} className="rounded-lg py-4">
                    <CardHeader className="px-4">
                      <CardTitle className="truncate text-sm">{item.reason}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4">
                      <p className="font-mono text-2xl font-semibold text-destructive">
                        {item.count}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
