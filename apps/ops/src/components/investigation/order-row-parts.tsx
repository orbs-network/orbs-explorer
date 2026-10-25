"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Copy as CopyIcon } from "lucide-react";
import type { ListOrder } from "@orbs/domain/twap/types";
import type { Token } from "@orbs/domain/types";
import { useToken } from "@orbs/domain/hooks/use-token";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { hasTokenSymbol } from "@orbs/domain/token-metadata";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { shortenAddress } from "@orbs/domain/utils/utils";
import { NetworkIcon } from "@orbs/ui/controls/network";
import { Button } from "@orbs/ui/controls/button";
import { reportedNumber } from "../../lib/order-diagnostics";
import { deadlineTime } from "../../lib/execution-analytics";
import { getOrderStatusConflict } from "../../lib/order-evidence";
import {
  formatOrderDate,
  STATUS_COLORS,
} from "../orders-overview/overview-display";
import {
  compactOrderNetwork,
  orderListMessage,
  orderRowStatus,
  relativeOrderTime,
} from "./order-presentation";

export const ORDER_ERROR_CLASS = "text-destructive";

function RowToken({
  address,
  chainId,
  token,
  label,
  resolveMetadata,
}: {
  address: string;
  chainId?: number;
  token?: Token;
  label: "input" | "output";
  resolveMetadata: boolean;
}) {
  const embedded =
    token?.address?.toLowerCase() === address?.toLowerCase() &&
    hasTokenSymbol(token)
      ? token
      : undefined;
  const { data } = useToken(address, chainId, !!embedded || !resolveMetadata);
  const copy = useCopy();
  const symbol =
    embedded?.symbol || (hasTokenSymbol(data) ? data?.symbol : undefined);
  if (symbol)
    return (
      <span className="max-w-20 truncate" title={`${symbol} · ${address}`}>
        {symbol}
      </span>
    );
  return (
    <span className="inline-flex min-w-0 items-center gap-0.5">
      <span
        className="max-w-24 truncate font-mono text-[11px]"
        aria-label={`${label} token ${address || "unreported"}; metadata unavailable`}
      >
        {address ? shortenAddress(address) : "Unreported"}
      </span>
      {address && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative z-20 size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
          title={`Copy ${label} token address: ${address}`}
          aria-label={`Copy ${label} token address`}
          onClick={() => copy(address)}
        >
          <CopyIcon aria-hidden className="size-3" />
        </Button>
      )}
    </span>
  );
}

export function OrderRowPair({
  order,
  resolveMetadata = true,
}: {
  order: ListOrder;
  resolveMetadata?: boolean;
}) {
  const chainId = getTwapOrderChainId(order);
  return (
    <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap font-medium">
      <RowToken
        address={order.inputToken}
        chainId={chainId}
        token={order.metadata.srcToken}
        label="input"
        resolveMetadata={resolveMetadata}
      />
      <ArrowRight
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground"
      />
      <RowToken
        address={order.outputToken}
        chainId={chainId}
        token={order.metadata.dstToken}
        label="output"
        resolveMetadata={resolveMetadata}
      />
    </span>
  );
}

export function OrderRowNetwork({ order }: { order: ListOrder }) {
  const chainId = getTwapOrderChainId(order);
  const network = compactOrderNetwork(chainId);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px]"
      title={network.title}
    >
      <NetworkIcon chainId={chainId} name={network.label} />
      {network.label}
    </span>
  );
}

export function OrderRowStatus({
  order,
  href,
  compact = false,
  reasonDisplay = "truncate",
}: {
  order: ListOrder;
  href: string;
  compact?: boolean;
  reasonDisplay?: "truncate" | "full";
}) {
  const status = getOverviewOrderStatus(order);
  const message = orderListMessage(order);
  const conflict = getOrderStatusConflict(order);
  return (
    <div
      className={
        compact
          ? "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
          : "flex min-w-0 max-w-[29rem] items-center gap-2"
      }
    >
      <span
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium ${message.error ? ORDER_ERROR_CLASS : STATUS_COLORS[status]}`}
        title={`Service status: ${order.metadata.status || "Not provided"}`}
      >
        {message.error && (
          <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
        )}
        {orderRowStatus(order)}
      </span>
      {conflict && (
        <span
          className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] text-amber-800 dark:text-amber-300"
          title={conflict.message}
        >
          Review outcome
        </span>
      )}
      {message.text && (
        <Link
          href={href}
          tabIndex={-1}
          draggable={false}
          className={`relative z-20 block min-w-0 select-text text-xs leading-relaxed hover:underline ${reasonDisplay === "full" ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]" : compact ? "basis-full line-clamp-2 whitespace-normal break-words [overflow-wrap:anywhere]" : "truncate"} ${message.error ? ORDER_ERROR_CLASS : "text-muted-foreground"}`}
          title={message.text}
        >
          {reasonDisplay === "full"
            ? message.text
            : withoutRawUnits(message.text)}
        </Link>
      )}
    </div>
  );
}

/** Price-check reasons repeat both prices in raw token units; the list only needs the readable values. */
const withoutRawUnits = (text: string) =>
  text.replace(/\s*\(\d{6,} vs\.? \d{6,}\)/g, "");

export function OrderRowProgress({ order }: { order: ListOrder }) {
  const summary = order.metadata.chunkSummary;
  return (
    <span
      className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
      title={`${reportedNumber(summary?.success) ?? "Unreported"} successful / ${reportedNumber(order.metadata.expectedChunks) ?? "unreported"} planned chunks`}
    >
      {reportedNumber(summary?.success) ?? "?"}/
      {reportedNumber(order.metadata.expectedChunks) ?? "?"}
    </span>
  );
}

export function OrderRowErrors({ order }: { order: ListOrder }) {
  const errors = reportedNumber(order.metadata.chunkSummary?.error);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums ${errors && errors > 0 ? ORDER_ERROR_CLASS : "text-muted-foreground"}`}
    >
      {errors !== undefined && errors > 0 && (
        <AlertTriangle aria-hidden className="size-3" />
      )}
      {errors === undefined
        ? "—"
        : errors > 0
          ? `${errors} ${errors === 1 ? "error" : "errors"}`
          : null}
    </span>
  );
}

export function OrderRowTime({
  order,
  now,
}: {
  order: ListOrder;
  now: number;
}) {
  return (
    <time
      dateTime={order.timestamp}
      className="whitespace-nowrap text-[11px] text-muted-foreground"
      title={`Placed ${formatOrderDate(order.timestamp)} · Deadline ${formatOrderDate(deadlineTime(order))}`}
    >
      {relativeOrderTime(order.timestamp, now)}
    </time>
  );
}

function RawValue({ value, label }: { value: unknown; label: string }) {
  const copy = useCopy();
  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  return text ? (
    <span className="relative z-20 inline-flex min-w-0 max-w-full items-start gap-1 font-mono text-[11px]">
      <span className="min-w-0 select-text break-all" title={text}>
        {text}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground"
        onClick={() => copy(text)}
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
      >
        <CopyIcon aria-hidden className="size-3" />
      </Button>
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function OrderRawDetails({ order }: { order: ListOrder }) {
  const summary = order.metadata.chunkSummary;
  const parsedChainId = getTwapOrderChainId(order);
  const reportedChainId =
    order.order.witness.chainId ?? order.order.witness.chainid;
  const chainId =
    parsedChainId ??
    (reportedChainId == null ? "Unreported" : `${reportedChainId} (invalid)`);
  const fields: [string, string | number | undefined][] = [
    ["Order hash", order.hash],
    ["Chain ID", chainId],
    [
      "Raw status / display",
      `${order.metadata.status || "Unreported"} / ${order.metadata.displayOnlyStatus || "Unreported"}`,
    ],
    ["Raw type", order.metadata.orderType],
    ["Adapter address", order.exchangeAdapter],
    ["Input token address", order.inputToken],
    ["Output token address", order.outputToken],
    ["Latest chunk", summary?.lastChunkStatus],
    ["Returned chunks", reportedNumber(summary?.total)],
  ];
  return (
    <dl
      aria-label="Raw order fields"
      className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">{label}</dt>
          <dd className="mt-1 min-w-0">
            <RawValue value={value} label={label.toLowerCase()} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
