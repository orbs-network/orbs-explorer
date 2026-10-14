"use client";

import { ActivityTime } from "@/components/activity-summary";
import { Button } from "@/components/ui/button";
import { TokenAmount } from "@/components/token-amount";
import { getOrderStory, explainOrderReason } from "@/lib/activity/order-story";
import {
  getOrderConditionComparison,
  getOrderCheckTiming,
  type OrderConditionComparison,
} from "@/lib/activity/order-condition";
import { useOrderViewContext } from "./use-order-view-context";
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import BN from "bignumber.js";

function conditionAmount(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat(undefined, { maximumSignificantDigits: 9 }).format(
        numeric,
      )
    : value;
}

function PriceCondition({
  condition,
  symbol,
  checkedAt,
  scheduledTrades,
}: {
  condition: OrderConditionComparison;
  symbol?: string;
  checkedAt?: string;
  scheduledTrades: number;
}) {
  const unit = symbol || "output tokens";
  const needsChange = new BN(condition.difference).gt(0);
  return (
    <div className="mt-4 rounded-lg border border-border bg-background/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p className="font-medium">
          {scheduledTrades > 1
            ? "Price condition for the next trade"
            : "Price condition"}
        </p>
        {checkedAt && (
          <span>
            Checked <ActivityTime value={checkedAt} />
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">
            Latest receive estimate
          </dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xl font-semibold tabular-nums sm:text-2xl">
            <span className="break-all">
              {conditionAmount(condition.current)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          </dd>
        </div>
        <div className="min-w-0 border-l border-border pl-4">
          <dt className="text-xs text-muted-foreground">
            {condition.kind === "limit"
              ? "Your minimum"
              : "Your trigger target"}
          </dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xl font-semibold tabular-nums sm:text-2xl">
            <span className="break-all">
              {conditionAmount(condition.target)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        {needsChange ? (
          <>
            <strong className="font-medium text-amber-700 dark:text-amber-400">
              {condition.direction === "at-least"
                ? `${conditionAmount(condition.difference)} ${unit} more needed.`
                : `The estimate must fall by ${conditionAmount(condition.difference)} ${unit}.`}
            </strong>{" "}
            {condition.kind === "limit"
              ? "The estimate must meet your minimum before the trade can run."
              : `The receive estimate must be ${condition.direction === "at-least" ? "at or above" : "at or below"} your trigger target.`}
          </>
        ) : (
          "The latest estimate is at the target. Waiting for the service’s next order update."
        )}
      </p>
    </div>
  );
}

export function OrderStatus() {
  const {
    order,
    type,
    chainId,
    dstToken,
    dataUpdatedAt,
    isFetching,
    refetch,
    dstFilledAmount,
  } = useOrderViewContext();
  const story = getOrderStory(order);
  const comparison = story.waitingForPrice
    ? getOrderConditionComparison(story.reason, type)
    : undefined;
  const reportedReason = story.ended
    ? order.metadata.displayOnlyStatusDescription || order.metadata.description
    : story.reason;
  const reason =
    story.ended && getOrderConditionComparison(reportedReason, type)
      ? undefined
      : story.ended
        ? reportedReason?.trim()
        : explainOrderReason(reportedReason, dstToken?.symbol);
  const title = comparison ? "Waiting for price" : story.title;
  const explanation = comparison
    ? comparison.kind === "limit"
      ? "Your minimum receive amount hasn’t been met. The order is still active and checks run automatically."
      : "Your trigger target hasn’t been reached. The order is still active and checks run automatically."
    : story.explanation;
  const timing = getOrderCheckTiming(story.nextCheck, dataUpdatedAt);
  const Icon =
    story.tone === "success"
      ? CheckCircle2
      : story.tone === "error" || story.tone === "warning"
        ? AlertCircle
        : Clock;
  const outputsKnown =
    story.amountsKnown &&
    order.metadata.chunks
      .filter((chunk) => chunk.status.toLowerCase() === "success")
      .every((chunk) => chunk.outAmount !== undefined);
  const tone =
    story.tone === "success"
      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
      : story.tone === "error"
        ? "text-destructive bg-destructive/10"
        : "text-amber-700 dark:text-amber-400 bg-amber-500/10";
  return (
    <section
      aria-label="Order status"
      className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-panel sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full",
              tone,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {explanation}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-label={isFetching ? "Refreshing status" : "Refresh status"}
          title="Refresh status"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            aria-hidden
            className={cn("size-3.5", isFetching && "motion-safe:animate-spin")}
          />
          <span className="hidden sm:inline">
            {isFetching ? "Refreshing…" : "Refresh"}
          </span>
        </Button>
      </div>
      {comparison ? (
        <PriceCondition
          condition={comparison}
          symbol={dstToken?.symbol}
          checkedAt={order.metadata.lastPriceCheck}
          scheduledTrades={story.expected}
        />
      ) : reason && story.tone !== "success" ? (
        <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm leading-relaxed [overflow-wrap:anywhere]">
          {reason}
        </p>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Traded so far</dt>
          <dd className="mt-1 text-sm font-medium">
            {story.amountsKnown ? (
              <TokenAmount
                amountRaw={story.filledRaw}
                address={order.order.witness.input.token}
                chainId={chainId}
              />
            ) : (
              "Not fully reported"
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">
            {story.ended ? "Left untraded" : "Still to trade"}
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {story.amountsKnown ? (
              <TokenAmount
                amountRaw={story.remainingRaw}
                address={order.order.witness.input.token}
                chainId={chainId}
              />
            ) : (
              "Not fully reported"
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Received so far</dt>
          <dd className="mt-1 text-sm font-medium">
            {outputsKnown ? (
              <TokenAmount
                amountRaw={dstFilledAmount.raw || "0"}
                address={order.order.witness.output.token}
                chainId={chainId}
              />
            ) : (
              "Not fully reported"
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium">
            {story.filled} of {story.expected || "unknown"} trades completed
          </span>
          {story.amountsKnown && (
            <span className="tabular-nums text-muted-foreground">
              {story.progress.toFixed(1)}% traded
            </span>
          )}
        </div>
        {story.amountsKnown && (
          <div
            role="progressbar"
            aria-label="Order amount traded"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(story.progress.toFixed(1))}
            aria-valuetext={`${story.progress.toFixed(1)}% of the order amount traded`}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full",
                story.tone === "success"
                  ? "bg-emerald-600 dark:bg-emerald-400"
                  : "bg-primary",
              )}
              style={{ width: `${story.progress}%` }}
            />
          </div>
        )}
        <div className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {!story.ended && (
            <p>
              {timing.state === "scheduled" ? (
                <>
                  Next automatic check{" "}
                  <ActivityTime value={timing.time} precision="second" />
                </>
              ) : timing.state === "awaiting" ? (
                "Waiting for the next automatic check"
              ) : (
                "Next automatic check time not reported"
              )}
            </p>
          )}
          <p>
            Updated <ActivityTime value={dataUpdatedAt} />
          </p>
        </div>
      </div>
    </section>
  );
}
