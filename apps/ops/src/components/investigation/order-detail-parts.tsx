"use client";
import { reportedNumber } from "@/lib/order-diagnostics";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Clock3,
  Copy as CopyIcon,
  ExternalLink,
  Info,
} from "lucide-react";
import { isAddress } from "viem";
import type { ListOrder, Order, OrderChunk } from "@orbs/domain/twap/types";
import { useToken } from "@orbs/domain/hooks/use-token";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { getChain, shortenAddress } from "@orbs/domain/utils/utils";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { CURRENT_SINK_API_URL, SINK_API_URLS } from "@orbs/domain/twap/api";
import {
  getOverviewOrderStatus,
  OVERVIEW_STATUSES,
} from "@orbs/domain/twap/utils/orders-overview";
import { Button } from "@orbs/ui/controls/button";
import { Badge } from "@orbs/ui/controls/badge";
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
  reportedScheduleValue,
  reportedTime,
  sortedOrderChunks,
  tokenUnits,
  conciseOrderMessage,
  isZeroOutputLimit,
  orderScheduleLabel,
} from "./order-presentation";
import {
  chunkReason,
  detailReasonObservations,
  getOrderStatusConflict,
  reportedExecutionInput,
} from "@/lib/order-evidence";

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
}: {
  address: string;
  chainId?: number;
  raw?: string;
  label: string;
}) {
  const { data } = useToken(address, chainId);
  const amount = tokenUnits(raw, data?.decimals);
  const compact = amount === undefined ? undefined : compactTokenAmount(amount);
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-medium tabular-nums">
        {amount !== undefined ? (
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
            Unreported
          </span>
        )}
      </dd>
    </div>
  );
}

export function OrderSummary({
  full,
  list,
  appName,
  appId,
  queryString,
  cachedList,
  listUpdatedAt,
  retrievedAt,
}: {
  full: Order;
  list: ListOrder;
  appName: string;
  appId?: string;
  queryString: string;
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
  const maximum = witness.input?.maxAmount;
  const remainingInput =
    executedInput !== undefined &&
    /^\d+$/.test(maximum ?? "") &&
    BigInt(maximum) >= BigInt(executedInput)
      ? (BigInt(maximum) - BigInt(executedInput)).toString()
      : undefined;
  const nextEligible = reportedScheduleValue(full.metadata.nextEligibleTime);
  const nextPriceCheck = reportedScheduleValue(
    full.metadata.displayOnlyPriceCheckNextTime,
  );
  const nextRetry = reportedScheduleValue(
    chunks[0]?.displayOnlyBackoffNextTime,
  );
  const deadline = reportedTime(witness.deadline);
  const sourceLabel = full.source
    ? `Service ${full.source}`
    : "Service unreported";
  const successfulChunks = list.metadata.chunkSummary.success;
  const plannedChunks = full.metadata.expectedChunks;
  const hasProgress =
    Number.isSafeInteger(plannedChunks) &&
    plannedChunks > 0 &&
    Number.isSafeInteger(successfulChunks) &&
    successfulChunks >= 0 &&
    successfulChunks <= plannedChunks;
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
                ? "The service reports that the order ended as Failed. Review the reported reasons below."
                : "The service returned an unrecognized outcome. Review its raw status in Technical details.";
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section
        aria-label="Order summary"
        className="min-w-0 rounded-xl bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="inline-flex min-w-0 max-w-full items-center gap-3 text-xl font-semibold tracking-tight sm:text-2xl">
            <OrderTokenName address={witness.input?.token} chainId={chainId} />
            <ArrowRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <OrderTokenName address={witness.output?.token} chainId={chainId} />
          </h2>
          <Badge variant="outline" className={STATUS_COLORS[status]}>
            {OVERVIEW_STATUSES[status].label}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
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
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {status === "active" && hasProgress && successfulChunks > 0
            ? `${successfulChunks.toLocaleString()} of ${plannedChunks?.toLocaleString()} planned chunks completed. `
            : ""}
          {summary}
        </p>
        {conflict && (
          <div
            role="note"
            aria-label="Outcome needs review"
            className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm"
          >
            <p className="font-medium">
              {conflict.kind === "structured"
                ? "Conflicting status fields"
                : "Termination reason needs review"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {conflict.message}
            </p>
          </div>
        )}
        {message && (
          <div
            role="note"
            aria-label={
              primary?.label ||
              (fallback.error
                ? "Latest execution error"
                : "Latest reported message")
            }
            className={`mt-4 rounded-lg p-3 text-sm ${primary?.error || fallback.error ? "bg-destructive/10" : "bg-muted/40"}`}
          >
            <div className="flex items-start gap-2">
              {primary?.error || fallback.error ? (
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
                <p
                  className={`text-xs font-medium ${primary?.error || fallback.error ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {primary?.label ||
                    (fallback.error
                      ? "Latest execution error"
                      : "Latest reported message")}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {conciseOrderMessage(message)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {primary?.timestamp
                    ? `Reported ${formatOrderDate(reportedTime(primary.timestamp))}`
                    : "Report time unreported"}
                </p>
                <details className="mt-2 text-xs">
                  <summary className="w-fit cursor-pointer rounded text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Full reason & source
                  </summary>
                  <p className="mt-2 text-muted-foreground">
                    {sourceLabel} ·{" "}
                    {primary?.field || "No reason field returned"}. A chunk
                    timestamp is its last reported time; it does not establish
                    an actual transaction execution time.
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {message}
                  </p>
                </details>
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
        <div className="mt-5 grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
          <dl className="min-w-0 [&_dd]:text-lg sm:[&_dd]:text-xl">
            <TokenAmount
              address={witness.input?.token}
              chainId={chainId}
              raw={maximum}
              label="Maximum requested input"
            />
          </dl>
          <dl className="min-w-0 [&_dd]:text-lg sm:[&_dd]:text-xl">
            {isZeroOutputLimit(witness.output?.limit) ? (
              <div>
                <dt className="text-xs text-muted-foreground">Output limit</dt>
                <dd className="mt-1 font-medium">Minimum output not set</dd>
                <dd className="mt-1 text-xs! text-muted-foreground">
                  The reported order has no positive minimum output. This is not
                  an estimated return.
                </dd>
              </div>
            ) : (
              <TokenAmount
                address={witness.output?.token}
                chainId={chainId}
                raw={witness.output?.limit}
                label="Output limit · order condition"
              />
            )}
          </dl>
        </div>
        {cachedList &&
          reportedNumber(cachedList.totalUSDAmount) !== undefined && (
            <div className="mt-4 text-sm">
              <span className="text-muted-foreground">Placed value (USD)</span>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 2,
                }).format(reportedNumber(cachedList.totalUSDAmount)!)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reported submitted value from the order-history snapshot
                {listUpdatedAt ? ` · ${formatOrderDate(listUpdatedAt)}` : ""};
                not executed volume.
              </p>
            </div>
          )}
        <dl className="mt-4 grid gap-x-6 gap-y-4 empty:hidden sm:grid-cols-2 xl:grid-cols-3">
          {witness.input?.amount !== maximum && (
            <TokenAmount
              address={witness.input?.token}
              chainId={chainId}
              raw={witness.input?.amount}
              label="Requested input per trade"
            />
          )}
          {/* Fill amounts are often absent; a pair of "Unreported" values adds nothing. */}
          {executedInput !== undefined && (
            <>
              <TokenAmount
                address={witness.input?.token}
                chainId={chainId}
                raw={executedInput}
                label="Reported successful input"
              />
              <TokenAmount
                address={witness.input?.token}
                chainId={chainId}
                raw={remainingInput}
                label="Remaining against input maximum"
              />
            </>
          )}
        </dl>
        {observations.length > 1 && (
          <details className="mt-3 text-xs">
            <summary className="w-fit cursor-pointer rounded text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Other reported reasons ({observations.length - 1})
            </summary>
            <div className="mt-2 space-y-3 rounded-lg bg-muted/40 p-3">
              {observations.slice(1).map((observation) => (
                <div key={observation.text}>
                  <p className="font-medium">
                    {observation.label}
                    {observation.timestamp
                      ? ` · Reported ${formatOrderDate(reportedTime(observation.timestamp))}`
                      : " · Report time unreported"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {observation.text}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {sourceLabel} · {observation.field}
                    {observation.historical
                      ? " · Historical error; current outcome is shown above."
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
        {differingListMessage && (
          <details className="mt-3 rounded-lg bg-amber-500/10 p-3 text-xs">
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
        <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Wallet</dt>
            <dd className="mt-1">
              <OrderAddress
                value={witness.swapper}
                chainId={chainId}
                label="Wallet"
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Placed</dt>
            <dd className="mt-1 text-sm">{formatOrderDate(full.timestamp)}</dd>
          </div>
        </dl>
      </section>
      <aside aria-label="Execution details" className="min-w-0">
        <Panel title="Execution">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {successfulChunks}
                <span className="ml-1.5 text-lg font-normal text-muted-foreground">
                  / {plannedChunks ?? "?"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Trades completed / planned
              </p>
            </div>
            {list.metadata.chunkSummary.error > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <CircleAlert aria-hidden className="size-3.5" />
                {list.metadata.chunkSummary.error} chunk{" "}
                {list.metadata.chunkSummary.error === 1 ? "error" : "errors"}
              </p>
            )}
          </div>
          {hasProgress && (
            <progress
              value={successfulChunks}
              max={plannedChunks}
              aria-label="Successful chunks"
              className="mt-4 block h-1.5 w-full overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
            />
          )}
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Clock3 aria-hidden className="size-4 text-muted-foreground" />
              Schedule
            </h3>
            <dl className="mt-4 space-y-4">
              {/* Upcoming check times only apply while the order can still execute. */}
              {(status === "active"
                ? [
                    [
                      orderScheduleLabel("eligible", nextEligible, retrievedAt),
                      nextEligible,
                    ],
                    [
                      orderScheduleLabel("price", nextPriceCheck, retrievedAt),
                      nextPriceCheck,
                    ],
                    [
                      orderScheduleLabel("retry", nextRetry, retrievedAt),
                      nextRetry,
                    ],
                  ]
                : []
              )
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-sm">
                      {reportedTime(value)
                        ? formatOrderDate(reportedTime(value))
                        : value || "Not reported"}
                    </dd>
                  </div>
                ))}
              <div>
                <dt className="text-xs text-muted-foreground">Deadline</dt>
                <dd className="mt-1 text-sm">{formatOrderDate(deadline)}</dd>
              </div>
            </dl>
          </div>
        </Panel>
      </aside>
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
  const [raw, setRaw] = useState(false);
  const chainId = getTwapOrderChainId(full);
  const failed = /^(error|failed)$/i.test(chunk.status);
  const message = chunkReason(chunk);
  return (
    <article className="rounded-lg bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Chunk {chunk.index}</h3>
        <Badge
          variant="outline"
          className={
            failed
              ? "border-transparent bg-destructive/10 text-destructive"
              : /^success$/i.test(chunk.status)
                ? "border-transparent bg-success/10 text-success"
                : "border-transparent bg-muted"
          }
        >
          {chunk.status || "Status not reported"}
        </Badge>
      </div>
      <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Reported due time</dt>
          <dd className="mt-1">
            {formatOrderDate(reportedTime(chunk.displayOnlyDueTime))}
          </dd>
        </div>
        {chunk.displayOnlyBackoffNextTime && (
          <div>
            <dt className="text-muted-foreground">Retry eligible after</dt>
            <dd className="mt-1">
              {formatOrderDate(reportedTime(chunk.displayOnlyBackoffNextTime))}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Last reported</dt>
          <dd className="mt-1">
            {formatOrderDate(
              reportedTime(chunk.timestamp) ?? reportedTime(chunk.createdAt),
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Transaction</dt>
          <dd>
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
          <dd>
            <OrderAddress
              value={chunk.executor}
              chainId={chainId}
              label={`Chunk ${chunk.index} executor`}
            />
          </dd>
        </div>
      </dl>
      {message && (
        <p
          className={`mt-2 whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere] ${failed ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      )}
      {chunk.extraTitle && chunk.extraTitle.trim() !== message && (
        <details className="mt-3 text-xs">
          <summary className="w-fit cursor-pointer rounded text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Full raw execution reason
          </summary>
          <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {chunk.extraTitle}
          </p>
        </details>
      )}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Amounts & reported fields
        </summary>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
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
          {[
            ["Solver", chunk.solverReportedOutput?.solverName],
            ["Reported fee", chunk.displayOnlyFee],
            [
              "Settled",
              chunk.settled == null ? undefined : String(chunk.settled),
            ],
            ["Transfer fee error", chunk.transferFeeEstimation?.error],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words">{value || "Not provided"}</dd>
            </div>
          ))}
        </dl>
      </details>
      <details
        onToggle={(event) => setRaw(event.currentTarget.open)}
        className="mt-3 text-xs"
      >
        <summary className="cursor-pointer rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Chunk service payload
        </summary>
        {raw && (
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">
            {JSON.stringify(chunk, null, 2)}
          </pre>
        )}
      </details>
    </article>
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
        <div className="space-y-3">
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
