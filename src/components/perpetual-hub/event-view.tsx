"use client";

import Link from "next/link";
import moment from "moment";
import type { ComponentType, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CircleDollarSign,
  Clock,
  Database,
  ExternalLink,
  Hash,
} from "lucide-react";
import {
  formatPerpetualHubActionName,
  formatPerpetualHubMarket,
  usePerpetualHubEvent,
} from "@/lib/perpetual-hub";
import { appendPerpetualHubScope } from "@/lib/perpetual-hub/query-scope";
import type { PerpetualHubOperation } from "@/lib/perpetual-hub";
import { ROUTES } from "@/lib/routes";
import { formatNumber, formatUsdCompact } from "@/lib/explorer/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn, shortenAddress } from "@/lib/utils/utils";

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function timestampMs(timestamp?: number) {
  if (!timestamp) return 0;
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

function formatTimestamp(timestamp?: number) {
  const ms = timestampMs(timestamp);
  if (!ms) return "-";
  return moment(ms).format("MMM D, YYYY HH:mm:ss");
}

function formatSignedUsd(value?: number) {
  if (value === undefined || !Number.isFinite(value) || value === 0) return "-";
  return `${value > 0 ? "+" : "-"}${formatUsdCompact(Math.abs(value))}`;
}

function isUserAddress(value?: string) {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function truncate(value?: string, chars = 7) {
  if (!value) return "-";
  if (value.startsWith("0x") && value.length > 14)
    return shortenAddress(value, chars);
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function eventNotional(event: PerpetualHubOperation) {
  const quantity = Math.abs(toNumber(event.quantity) ?? 0);
  const price = Math.abs(toNumber(event.price) ?? 0);
  if (quantity && price) return quantity * price;

  const amount = Math.abs(toNumber(event.amount) ?? 0);
  return amount || undefined;
}

function chainTxUrl(chainId: number | undefined, txHash: string) {
  if (chainId === 137) return `https://polygonscan.com/tx/${txHash}`;
  return `https://arbiscan.io/tx/${txHash}`;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isSuccess = normalized.includes("success");
  const isRejected =
    normalized.includes("reject") ||
    normalized.includes("fail") ||
    normalized.includes("error");

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        isSuccess && "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
        isRejected &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        !isSuccess &&
          !isRejected &&
          "border-amber-500/40 bg-amber-500/10 text-amber-500",
      )}
    >
      {status}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  tone?: "positive" | "negative";
}) {
  return (
    <Card className="rounded-lg py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-1 break-all text-2xl font-semibold tabular-nums",
                tone === "positive" && "text-emerald-500",
                tone === "negative" && "text-destructive",
              )}
            >
              {value}
            </p>
          </div>
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

export function PerpetualHubEventView({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { data, isLoading, isError, error } = usePerpetualHubEvent(id);

  const scopedHref = (path: string) =>
    appendPerpetualHubScope(path, searchParams);

  if (!/^\d+$/.test(id)) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">
        <p className="font-semibold">Invalid event ID</p>
        <p className="mt-2 font-mono text-sm">{id}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Spinner size={28} className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading event</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">
        <p className="font-semibold">Failed to load event</p>
        <p className="mt-2 text-sm opacity-90">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const { event } = data;
  const actionLabel = formatPerpetualHubActionName(event.operationType);
  const quantity = toNumber(event.quantity);
  const price = toNumber(event.price);
  const amount = toNumber(event.amount);
  const fee = toNumber(event.fee);
  const pnl = toNumber(event.realizedPnl);
  const notional = eventNotional(event);
  const rawEvent = event as Record<string, unknown>;
  const orderId = rawEvent.orderId ?? rawEvent.orderID;
  const requestId = rawEvent.requestId ?? rawEvent.requestID;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 py-4 pb-16">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Event #{formatNumber(event.id, 0)}
            </h1>
            <Badge variant="secondary">{actionLabel}</Badge>
            <StatusBadge status={event.status} />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {[event.partnerName, event.chainName, event.contractAddress]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={scopedHref(ROUTES.PERPETUAL_HUB.ACTIONS)}>
            <ArrowLeft className="h-4 w-4" />
            Actions
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Notional"
          value={notional ? formatUsdCompact(notional) : "-"}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Quantity"
          value={quantity ? formatNumber(quantity, 4) : "-"}
          icon={Activity}
        />
        <MetricCard
          label="Fee"
          value={fee ? formatUsdCompact(fee) : "-"}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Realized PnL"
          value={formatSignedUsd(pnl)}
          icon={CircleDollarSign}
          tone={
            pnl !== undefined && pnl > 0
              ? "positive"
              : pnl !== undefined && pnl < 0
                ? "negative"
                : undefined
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-lg py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-sm">Event Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm">
            <dl>
              <DetailRow label="Action">{actionLabel}</DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={event.status} />
              </DetailRow>
              <DetailRow label="Timestamp">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatTimestamp(event.timestamp)}
                </span>
              </DetailRow>
              <DetailRow label="Market">
                {formatPerpetualHubMarket(event.symbol)}
              </DetailRow>
              <DetailRow label="Side">{event.side || "-"}</DetailRow>
              <DetailRow label="Price">
                {price ? formatUsdCompact(price) : "-"}
              </DetailRow>
              <DetailRow label="Amount">
                {amount !== undefined ? formatNumber(amount, 6) : "-"}
              </DetailRow>
              <DetailRow label="Reject Reason">
                {event.rejectReason || "-"}
              </DetailRow>
              <DetailRow label="Order ID">
                {orderId !== undefined ? String(orderId) : "-"}
              </DetailRow>
              <DetailRow label="Request ID">
                {requestId !== undefined ? String(requestId) : "-"}
              </DetailRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-lg py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-sm">Hub Context</CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-sm">
            <dl>
              <DetailRow label="User Wallet">
                {isUserAddress(event.userAddress) ? (
                  <Link
                    href={scopedHref(
                      ROUTES.PERPETUAL_HUB.USER(event.userAddress),
                    )}
                    className="font-mono text-primary hover:underline"
                  >
                    {shortenAddress(event.userAddress, 7)}
                  </Link>
                ) : (
                  <span className="font-mono">{event.userAddress || "-"}</span>
                )}
              </DetailRow>
              <DetailRow label="Sequence">
                {event.teeSequence !== undefined ? (
                  <Link
                    href={scopedHref(
                      ROUTES.PERPETUAL_HUB.STATE(event.teeSequence),
                    )}
                    className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                  >
                    <Database className="h-3.5 w-3.5" />#
                    {formatNumber(event.teeSequence, 0)}
                  </Link>
                ) : (
                  "-"
                )}
              </DetailRow>
              <DetailRow label="State Root">
                <span className="break-all font-mono">
                  {event.stateRoot || "-"}
                </span>
              </DetailRow>
              <DetailRow label="Rollup">
                {event.rollupId !== undefined ? (
                  <Link
                    href={scopedHref(
                      ROUTES.PERPETUAL_HUB.ROLLUP(event.rollupId),
                    )}
                    className="font-mono text-primary hover:underline"
                  >
                    #{formatNumber(event.rollupId, 0)}
                  </Link>
                ) : (
                  "-"
                )}
              </DetailRow>
              <DetailRow label="Rollup Tx">
                {event.rollupTxHash ? (
                  <a
                    href={chainTxUrl(event.chainId, event.rollupTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all font-mono text-primary hover:underline"
                  >
                    {truncate(event.rollupTxHash)}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  "-"
                )}
              </DetailRow>
              <DetailRow label="Partner">{event.partnerName || "-"}</DetailRow>
              <DetailRow label="Chain">{event.chainName || "-"}</DetailRow>
              <DetailRow label="Contract">
                <span className="break-all font-mono">
                  {event.contractAddress || "-"}
                </span>
              </DetailRow>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Hash className="h-4 w-4 text-muted-foreground" />
            Raw Event Payload
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <pre className="max-h-[520px] overflow-auto bg-muted/30 p-4 text-xs leading-5">
            {JSON.stringify(event, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
