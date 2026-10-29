"use client";
import { reportedNumber } from "@/lib/order-diagnostics";
import { InlineSkeleton } from "@/components/loading-skeletons";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Copy as CopyIcon,
  ExternalLink,
  Info,
} from "lucide-react";
import { isAddress, maxUint256 } from "viem";
import type { ListOrder, Order, OrderChunk } from "@orbs/domain/twap/types";
import { useToken } from "@orbs/domain/hooks/use-token";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { getChain, shortenAddress } from "@orbs/domain/utils/utils";
import {
  getTwapOrderChainId,
  getSpotOrderLimitPrice,
} from "@orbs/domain/twap/utils";
import { CURRENT_SINK_API_URL, SINK_API_URLS } from "@orbs/domain/twap/api";
import {
  getOverviewOrderStatus,
  OVERVIEW_STATUSES,
} from "@orbs/domain/twap/utils/orders-overview";
import { Button } from "@orbs/ui/controls/button";
import { Badge } from "@orbs/ui/controls/badge";
import { Card, CardContent, CardHeader } from "@orbs/ui/controls/card";
import { Network } from "@orbs/ui/controls/network";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";
import { Panel, EmptyState } from "@/components/operations/primitives";
import {
  formatOrderDate,
  STATUS_COLORS,
} from "@/components/orders-overview/overview-display";
import { partnerHref } from "@/lib/partner-navigation";
import { OrderTokenLabel as OrderTokenName } from "@/components/orders-overview/order-token-label";
import {
  latestOrderError,
  compactTokenAmount,
  compactOrderType,
  orderListMessage,
  orderSummaryHeading,
  reportedTime,
  sortedOrderChunks,
  tokenUnits,
  conciseOrderMessage,
  isZeroOutputLimit,
} from "./order-presentation";
import {
  chunkReason,
  isCancellationChunk,
  isExecutionErrorChunk,
  detailReasonObservations,
  getOrderStatusConflict,
  reportedExecutionInput,
  reportedExecutionOutput,
} from "@/lib/order-evidence";
import { ChunkPayloadDialog } from "./chunk-payload-dialog";
import { RawExecutionReasonDialog } from "./raw-execution-reason-dialog";
import { OrderTradeSummary } from "./order-trade-summary";
import { OrderReasonDialog } from "./order-reason-dialog";

export function OrderAddress({
  value,
  chainId,
  label,
  transaction = false,
  showFull = false,
}: {
  value?: string;
  chainId?: number;
  label: string;
  transaction?: boolean;
  showFull?: boolean;
}) {
  const copy = useCopy();
  if (!value?.trim())
    return <span className="text-muted-foreground">Not provided</span>;
  const valid = transaction
    ? /^0x[0-9a-f]{64}$/i.test(value)
    : isAddress(value, { strict: false });
  const explorer = getChain(chainId)?.blockExplorers?.default?.url;
  const href =
    valid && explorer
      ? `${explorer}/${transaction ? "tx" : "address"}/${value}`
      : undefined;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1 rounded font-mono text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={value}
          aria-label={`${label}: ${value} (block explorer)`}
        >
          <span className="min-w-0 break-all">
            {showFull ? value : shortenAddress(value)}
          </span>
          <ExternalLink aria-hidden className="size-3 shrink-0" />
        </a>
      ) : (
        <span className="break-all font-mono text-xs" title={value}>
          {showFull ? value : shortenAddress(value)}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => copy(value)}
      >
        <CopyIcon aria-hidden className="size-3" />
      </Button>
    </span>
  );
}

function TokenAmount({
  address,
  chainId,
  raw,
  label,
  note,
}: {
  address: string;
  chainId?: number;
  raw?: string;
  label: string;
  note?: string;
}) {
  const { data, isLoading } = useToken(address, chainId);
  const amount = tokenUnits(raw, data?.decimals);
  const compact = amount === undefined ? undefined : compactTokenAmount(amount);
  return (
    <div className="min-w-0">
      <dt className="text-[13px] leading-5 text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 break-words font-medium leading-relaxed tabular-nums">
        {isLoading && raw?.trim() ? (
          <InlineSkeleton
            label={`Loading ${label.toLowerCase()}`}
            className="h-5 w-32"
          />
        ) : amount !== undefined ? (
          compact !== amount ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="cursor-help rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {compact} {data?.symbol || "tokens"}
                </span>
              </TooltipTrigger>
              <TooltipContent className="select-text break-all font-mono tabular-nums">
                {amount} {data?.symbol || "tokens"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span>
              {compact} {data?.symbol || "tokens"}
            </span>
          )
        ) : raw?.trim() ? (
          <>
            <span className="font-mono text-xs">{raw}</span>{" "}
            <span className="text-xs font-normal text-muted-foreground">
              raw units · decimals unavailable
            </span>
          </>
        ) : (
          <span className="text-sm font-normal text-muted-foreground">
            Not reported
          </span>
        )}
        {note && (
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {note}
          </p>
        )}
      </dd>
    </div>
  );
}

export function OrderIdentity({
  full,
  list,
  appName,
  appId,
  queryString,
}: {
  full: Order;
  list: ListOrder;
  appName: string;
  appId?: string;
  queryString: string;
}) {
  const chainId = getTwapOrderChainId(full);
  const witness = full.order.witness;
  const status = getOverviewOrderStatus(list);
  return (
    <section
      aria-label="Order overview"
      className="min-w-0 rounded-xl bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
          <h2 className="inline-flex min-w-0 max-w-full items-center gap-3 text-xl font-semibold tracking-tight sm:text-2xl">
            <OrderTokenName address={witness.input?.token} chainId={chainId} />
            <ArrowRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <OrderTokenName address={witness.output?.token} chainId={chainId} />
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <Network chainId={chainId} variant="inline" showChainId={false} />
            {appId ? (
              <Link
                href={partnerHref(appId, queryString)}
                className="rounded text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {appName}
              </Link>
            ) : (
              <span>{appName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {compactOrderType(full.metadata.orderType)}
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`mt-1 shrink-0 ${STATUS_COLORS[status]}`}
        >
          {OVERVIEW_STATUSES[status].label}
        </Badge>
      </div>
    </section>
  );
}

export function OrderSummary({
  full,
  list,
  cachedList,
  listUpdatedAt,
  retrievedAt,
}: {
  full: Order;
  list: ListOrder;
  cachedList?: ListOrder;
  listUpdatedAt?: number;
  retrievedAt: number;
}) {
  const chainId = getTwapOrderChainId(full);
  const witness = full.order.witness;
  const status = getOverviewOrderStatus(list);
  const error = latestOrderError(full);
  const chunks = sortedOrderChunks(full.metadata.chunks ?? []);
  const observations = detailReasonObservations(full, chunks, list);
  const primary = observations[0];
  const fallback = orderListMessage(list);
  const message = primary?.text || fallback.text;
  const cachedMessage = cachedList ? orderListMessage(cachedList) : undefined;
  const differingListMessage =
    cachedMessage?.text &&
    cachedMessage.text !== "No failure reason reported" &&
    !observations.some((observation) => observation.text === cachedMessage.text)
      ? cachedMessage
      : undefined;
  const conflict = getOrderStatusConflict(list);
  const executedInput = reportedExecutionInput(full);
  const executedOutput = reportedExecutionOutput(full);
  const placedUsd = reportedNumber(cachedList?.totalUSDAmount);
  const minimumOutput = /^\d+$/.test(witness.output?.limit?.trim() ?? "")
    ? getSpotOrderLimitPrice(full)
    : undefined;
  const maximum = witness.input?.maxAmount;
  const remainingInput =
    executedInput !== undefined &&
    /^\d+$/.test(maximum ?? "") &&
    BigInt(maximum) >= BigInt(executedInput)
      ? (BigInt(maximum) - BigInt(executedInput)).toString()
      : undefined;
  const sourceLabel = full.source
    ? `Service ${full.source}`
    : "Service unreported";
  const currentIssue =
    status === "failed" ||
    (status === "active" && Boolean(primary?.error || fallback.error));
  const summary =
    status === "active"
      ? fallback.error
        ? "Still active. The latest attempt reported an error; the order has not ended."
        : "Waiting for its trading condition or the next eligible attempt."
      : status === "completed"
        ? "The service reports this order completed. Any earlier errors remain in its execution history."
        : status === "partial"
          ? "The order ended with some planned trades completed."
          : status === "cancelled"
            ? "The order was cancelled. Successful trades before cancellation can still be present."
            : status === "expired"
              ? "The service reports that the order expired before all planned trades completed."
              : status === "failed"
                ? undefined
                : "The service returned an unrecognized outcome. Review its raw status in Technical details.";
  return (
    <div className="space-y-4">
      <section aria-label="Order summary" className="min-w-0 space-y-5">
        {(message || summary) && (
          <div
            role="note"
            aria-label={
              primary?.label ||
              (fallback.error
                ? "Latest execution error"
                : "Latest reported message")
            }
            className={`rounded-xl p-5 text-sm leading-6 sm:p-6 ${currentIssue ? "bg-destructive/10" : "bg-card"}`}
          >
            <div className="flex items-start gap-2">
              {currentIssue ? (
                <CircleAlert
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                />
              ) : (
                <Info
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3
                  className={`text-base font-semibold ${currentIssue ? "text-destructive" : "text-foreground"}`}
                >
                  {orderSummaryHeading(
                    list,
                    message,
                    Boolean(primary?.error || fallback.error),
                  )}
                </h3>
                <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {conciseOrderMessage(message || summary || "")}
                </p>
                {primary?.timestamp && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {primary?.timestamp
                      ? `Reported ${formatOrderDate(reportedTime(primary.timestamp))}`
                      : "Report time unreported"}
                  </p>
                )}
                {message && (
                  <div className="-ml-2 mt-1">
                    <OrderReasonDialog
                      reason={message}
                      source={sourceLabel}
                      field={primary?.field}
                      reportedAt={
                        primary?.timestamp
                          ? formatOrderDate(reportedTime(primary.timestamp))
                          : "Unreported"
                      }
                    />
                  </div>
                )}
                {status === "active" && currentIssue && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    The order is still active and can try again when eligible.
                  </p>
                )}
                {error && status === "completed" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    The order is completed; this error is retained in its
                    execution history.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {conflict?.kind === "structured" && (
          <div
            role="note"
            aria-label="Outcome needs review"
            className="mt-3 rounded-lg bg-warning-surface p-3 text-sm"
          >
            <p className="font-medium">Conflicting status fields</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {conflict.message}
            </p>
          </div>
        )}
        <section
          aria-label="Order amounts"
          className="space-y-4 rounded-xl bg-card p-4 sm:p-5"
        >
          <h3 className="text-sm font-semibold">Order amounts</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4 [&_dd]:mt-1 [&_dd]:text-lg [&_dd]:leading-6 [&_dt]:min-h-10 sm:[&_dt]:min-h-5">
            <TokenAmount
              address={witness.input?.token}
              chainId={chainId}
              raw={witness.input?.amount}
              label="Spend per trade"
            />
            <TokenAmount
              address={witness.output?.token}
              chainId={chainId}
              raw={minimumOutput}
              label="Minimum receive per trade"
              note={
                isZeroOutputLimit(minimumOutput)
                  ? "No minimum output set."
                  : undefined
              }
            />
            <TokenAmount
              address={witness.input?.token}
              chainId={chainId}
              raw={maximum}
              label="Maximum total spend"
            />
            <div className="min-w-0">
              <dt className="text-[13px] leading-5 text-muted-foreground">
                Value when placed (USD)
              </dt>
              <dd className="mt-1.5 font-medium leading-relaxed tabular-nums">
                {placedUsd === undefined ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    Not reported
                  </span>
                ) : (
                  new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 2,
                  }).format(placedUsd)
                )}
              </dd>
            </div>
          </dl>
          <div className="space-y-2.5 border-t border-border/60 pt-3">
            <h4 className="text-[13px] font-medium">Reported execution</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 [&_dd]:mt-1 [&_dd]:text-sm [&_dd]:leading-5">
              <TokenAmount
                address={witness.input?.token}
                chainId={chainId}
                raw={executedInput}
                label="Spent"
              />
              <TokenAmount
                address={witness.output?.token}
                chainId={chainId}
                raw={executedOutput}
                label="Received"
              />
              <TokenAmount
                address={witness.input?.token}
                chainId={chainId}
                raw={remainingInput}
                label="Input budget remaining"
              />
              {[
                ["Lower trigger per trade", witness.output?.triggerLower],
                ["Upper trigger per trade", witness.output?.triggerUpper],
                ["Stop output per trade", witness.output?.stop],
                ...(minimumOutput !== undefined &&
                minimumOutput !== witness.output?.limit &&
                BigInt(witness.output.limit) > BigInt(1)
                  ? [["Reported output condition", witness.output?.limit]]
                  : []),
              ]
                .filter(
                  ([, raw]) =>
                    /^\d+$/.test(raw ?? "") &&
                    BigInt(raw!) > BigInt(0) &&
                    BigInt(raw!) < maxUint256,
                )
                .map(([label, raw]) => (
                  <TokenAmount
                    key={label}
                    address={witness.output?.token}
                    chainId={chainId}
                    raw={raw}
                    label={label!}
                  />
                ))}
            </dl>
          </div>
          {placedUsd !== undefined && (
            <p className="max-w-4xl text-xs leading-5 text-muted-foreground">
              Placed value is the reported submitted value, not executed volume.
              {listUpdatedAt
                ? ` Snapshot ${formatOrderDate(listUpdatedAt)}.`
                : ""}
            </p>
          )}
        </section>
        <OrderTradeSummary full={full} list={list} retrievedAt={retrievedAt} />
        {differingListMessage && (
          <details className="mt-3 rounded-lg bg-warning-surface p-3 text-xs">
            <summary className="cursor-pointer rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              List and detail reasons differ
            </summary>
            <p className="mt-2 text-muted-foreground">
              The list observation is retained below.{" "}
              {cachedList?.source ? `Service ${cachedList.source}. ` : ""}List
              snapshot retrieved {formatOrderDate(listUpdatedAt)}; this is not
              an error-event timestamp. The summary above uses the direct detail
              response. These endpoints returned different descriptions.
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {differingListMessage.text}
            </p>
          </details>
        )}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 rounded-xl bg-card p-5 text-sm sm:grid-cols-2 sm:p-6">
          <div className="min-w-0">
            <dt className="text-[13px] text-muted-foreground">Wallet</dt>
            <dd className="mt-1">
              <OrderAddress
                value={witness.swapper}
                chainId={chainId}
                label="Wallet"
              />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px] text-muted-foreground">
              Output recipient
            </dt>
            <dd className="mt-1">
              <OrderAddress
                value={witness.output?.recipient}
                chainId={chainId}
                label="Output recipient"
              />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function TechnicalValue({ label, value }: { label: string; value: unknown }) {
  const copy = useCopy();
  const text =
    typeof value === "string"
      ? value.trim() || undefined
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : undefined;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-start gap-1">
        <code className="min-w-0 break-all text-xs">
          {text ?? "Not provided"}
        </code>
        {text !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label={`Copy ${label}`}
            onClick={() => copy(text)}
          >
            <CopyIcon aria-hidden className="size-3" />
          </Button>
        )}
      </dd>
    </div>
  );
}

export function OrderTerms({
  full,
  appName,
  requestedSource,
  updatedAt,
  adapterOrdersHref,
}: {
  full: Order;
  appName: string;
  requestedSource?: "v1" | "v2";
  updatedAt: number;
  adapterOrdersHref?: string;
}) {
  const witness = full.order.witness;
  const chainId = getTwapOrderChainId(full);
  const returnedService =
    full.source === "v2"
      ? "Current service (v2)"
      : full.source === "v1"
        ? "Legacy service (v1)"
        : "Not provided";
  const endpoint =
    full.source === "v2"
      ? CURRENT_SINK_API_URL
      : full.source === "v1"
        ? SINK_API_URLS.prod
        : undefined;
  return (
    <Panel
      title="Technical details"
      action={
        adapterOrdersHref ? (
          <Link
            href={adapterOrdersHref}
            className="inline-flex items-center gap-1 rounded text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Orders with this adapter
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <section aria-label="Record provenance" className="space-y-3">
          <h3 className="text-sm font-medium">Record provenance</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <TechnicalValue label="Order hash" value={full.hash} />
            <TechnicalValue label="Chain ID" value={chainId} />
            <div>
              <dt className="text-xs text-muted-foreground">Network</dt>
              <dd className="mt-1 text-xs">
                <Network
                  chainId={chainId}
                  variant="inline"
                  showChainId={false}
                />
              </dd>
            </div>
            <TechnicalValue label="Returned by" value={returnedService} />
            <TechnicalValue label="Service endpoint" value={endpoint} />
            <TechnicalValue
              label="Lookup mode"
              value={
                requestedSource
                  ? `Explicit ${requestedSource} override`
                  : "Automatic · both services"
              }
            />
            <TechnicalValue
              label="Retrieved"
              value={formatOrderDate(updatedAt)}
            />
            <TechnicalValue
              label="metadata.instanceId"
              value={full.metadata.instanceId}
            />
            <TechnicalValue
              label="metadata.orderType"
              value={full.metadata.orderType}
            />
          </dl>
        </section>
        <section
          aria-label="Witness addresses"
          className="space-y-3 border-t border-border pt-4"
        >
          <h3 className="text-sm font-medium">Witness & contract addresses</h3>
          <p className="text-xs text-muted-foreground">
            Exchange adapter: {appName}. Address and transaction links open the
            network’s block explorer.
          </p>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["witness.swapper", witness.swapper],
              ["witness.output.recipient", witness.output?.recipient],
              ["witness.exchange.adapter", witness.exchange?.adapter],
              ["witness.executor", witness.executor],
              ["witness.reactor", witness.reactor],
              ["order.spender", full.order.spender],
              ["witness.input.token", witness.input?.token],
              ["witness.output.token", witness.output?.token],
              ["order.permitted.token", full.order.permitted?.token],
              ["witness.exchange.ref", witness.exchange?.ref],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1">
                  <OrderAddress
                    value={value}
                    chainId={chainId}
                    label={label}
                    showFull
                  />
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section
          aria-label="Raw token amounts"
          className="space-y-3 border-t border-border pt-4"
        >
          <h3 className="text-sm font-medium">
            Amounts · original integer units
          </h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["witness.input.amount (raw)", witness.input?.amount],
              ["witness.input.maxAmount (raw)", witness.input?.maxAmount],
              ["witness.output.limit (raw)", witness.output?.limit],
              ["order.permitted.amount (raw)", full.order.permitted?.amount],
              ["witness.output.stop (raw)", witness.output?.stop],
              [
                "witness.output.triggerLower (raw)",
                witness.output?.triggerLower,
              ],
              [
                "witness.output.triggerUpper (raw)",
                witness.output?.triggerUpper,
              ],
            ].map(([label, value]) => (
              <TechnicalValue key={label} label={String(label)} value={value} />
            ))}
            <TokenAmount
              address={witness.input?.token}
              chainId={chainId}
              raw={witness.input?.maxAmount}
              label="Maximum input · token units"
            />
          </dl>
        </section>
        <section
          aria-label="Service and scheduling fields"
          className="space-y-3 border-t border-border pt-4"
        >
          <h3 className="text-sm font-medium">Service & scheduling fields</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["metadata.status", full.metadata.status],
              ["metadata.displayOnlyStatus", full.metadata.displayOnlyStatus],
              ["metadata.expectedChunks", full.metadata.expectedChunks],
              ["metadata.logLoopCounter", full.metadata.logLoopCounter],
              ["metadata.lastPriceCheck", full.metadata.lastPriceCheck],
              ["metadata.nextEligibleTime", full.metadata.nextEligibleTime],
              [
                "metadata.displayOnlyPriceCheckNextTime",
                full.metadata.displayOnlyPriceCheckNextTime,
              ],
              ["witness.epoch (seconds)", witness.epoch],
              ["witness.deadline (Unix seconds)", witness.deadline],
              ["order.deadline (Unix seconds)", full.order.deadline],
              ["witness.start", witness.start],
              ["order.nonce", full.order.nonce],
              ["witness.nonce", witness.nonce],
              ["witness.slippage (raw)", witness.slippage],
              ["witness.freshness", witness.freshness],
              ["witness.exclusivity", witness.exclusivity],
              ["witness.exchange.share (raw)", witness.exchange?.share],
            ].map(([label, value]) => (
              <TechnicalValue key={label} label={String(label)} value={value} />
            ))}
          </dl>
        </section>
      </div>
    </Panel>
  );
}

function ChunkRecord({ chunk, full }: { chunk: OrderChunk; full: Order }) {
  const chainId = getTwapOrderChainId(full);
  const cancelled = isCancellationChunk(chunk);
  const failed = isExecutionErrorChunk(chunk);
  const succeeded = /^success$/i.test(chunk.status);
  const message = chunkReason(chunk);
  const readableMessage = message ? conciseOrderMessage(message) : undefined;
  const rawReason = chunk.extraTitle?.trim() || message;
  return (
    <Card
      role="article"
      aria-label={`Chunk ${chunk.index}`}
      className="gap-4 border-0 bg-muted/30 p-4 shadow-none"
    >
      <CardHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-0">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold">Chunk {chunk.index}</h3>
          <Badge
            variant="outline"
            className={`gap-1.5 border-0 capitalize ${
              failed
                ? "bg-destructive/10 text-destructive"
                : succeeded
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {cancelled ? "Cancelled" : chunk.status || "Status not reported"}
          </Badge>
        </div>
        <div className="-ml-2 flex flex-wrap items-center gap-1">
          {rawReason && rawReason !== readableMessage && (
            <RawExecutionReasonDialog
              reason={rawReason}
              chunkIndex={chunk.index}
            />
          )}
          <ChunkPayloadDialog chunk={chunk} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {message && (
          <p
            className={`flex items-start gap-2 whitespace-pre-wrap break-words text-xs leading-relaxed [overflow-wrap:anywhere] ${failed ? "text-destructive" : "text-muted-foreground"}`}
          >
            {failed && (
              <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span className="min-w-0">{readableMessage}</span>
          </p>
        )}
        <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Reported due time</dt>
            <dd className="mt-1">
              {formatOrderDate(reportedTime(chunk.displayOnlyDueTime))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last reported</dt>
            <dd className="mt-1">
              {formatOrderDate(
                reportedTime(chunk.timestamp) ?? reportedTime(chunk.createdAt),
              )}
            </dd>
          </div>
          {!cancelled && chunk.displayOnlyBackoffNextTime && (
            <div>
              <dt className="text-muted-foreground">Retry eligible after</dt>
              <dd className="mt-1">
                {formatOrderDate(
                  reportedTime(chunk.displayOnlyBackoffNextTime),
                )}
              </dd>
            </div>
          )}
        </dl>
        <div className="grid gap-5 rounded-lg bg-background/40 p-3 text-xs lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className="min-w-0 space-y-2.5">
            <h4 className="text-xs font-medium">Amounts & reported fields</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <TokenAmount
                address={chunk.inToken || full.order.witness.input.token}
                chainId={chainId}
                raw={chunk.inAmount}
                label="Reported input"
              />
              <TokenAmount
                address={chunk.outToken || full.order.witness.output.token}
                chainId={chainId}
                raw={chunk.outAmount}
                label="Reported output"
              />
              {chunk.minOut != null && (
                <TokenAmount
                  address={chunk.outToken || full.order.witness.output.token}
                  chainId={chainId}
                  raw={chunk.minOut}
                  label="Minimum output for this trade"
                />
              )}
              {chunk.solverReportedOutput?.outputAmount != null && (
                <TokenAmount
                  address={chunk.outToken || full.order.witness.output.token}
                  chainId={chainId}
                  raw={chunk.solverReportedOutput.outputAmount}
                  label="Solver reported output"
                />
              )}
            </dl>
          </section>
          <section className="min-w-0 space-y-2.5">
            <h4 className="text-xs font-medium">Execution details</h4>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 [&>div]:min-w-0">
              <div>
                <dt className="text-muted-foreground">Transaction</dt>
                <dd className="mt-1">
                  <OrderAddress
                    value={chunk.txHash}
                    chainId={chainId}
                    label={`Chunk ${chunk.index} transaction`}
                    transaction
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Executor</dt>
                <dd className="mt-1">
                  <OrderAddress
                    value={chunk.executor}
                    chainId={chainId}
                    label={`Chunk ${chunk.index} executor`}
                  />
                </dd>
              </div>
              {[
                ["Solver", chunk.solverReportedOutput?.solverName],
                ["Reported fee", chunk.displayOnlyFee],
                [
                  "Settled",
                  chunk.settled == null ? undefined : String(chunk.settled),
                ],
                ["Transfer fee error", chunk.transferFeeEstimation?.error],
              ]
                .filter(([, value]) => value != null && value !== "")
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrderTimeline({ full }: { full: Order }) {
  const chunks = useMemo(
    () => sortedOrderChunks(full.metadata.chunks ?? []),
    [full.metadata.chunks],
  );
  const [limit, setLimit] = useState(20);
  return (
    <Panel
      title="Execution history"
      description="Reported chunks, newest first. Due times, retry eligibility, and last-reported timestamps are separate service fields; none establishes an actual execution time."
    >
      {!chunks.length ? (
        <EmptyState
          title="No execution chunks returned"
          description="The service has not supplied chunk records for this order."
        />
      ) : (
        <div className="space-y-2">
          {chunks.slice(0, limit).map((chunk, index) => (
            <ChunkRecord
              key={`${chunk.index}:${index}`}
              chunk={chunk}
              full={full}
            />
          ))}
          {chunks.length > limit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLimit((value) => value + 20)}
            >
              Show more chunks ({chunks.length - limit} remaining)
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
