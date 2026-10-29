"use client";

import type { ListOrder, Order } from "@orbs/domain/twap/types";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { formatDuration } from "@orbs/domain/utils/utils";
import { Progress } from "@orbs/ui/controls/progress";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import { executionErrorCount, reportedNumber } from "@/lib/order-diagnostics";
import {
  orderScheduleLabel,
  reportedScheduleValue,
  reportedTime,
  sortedOrderChunks,
} from "./order-presentation";

function ScheduleFields({
  title,
  fields,
}: {
  title: string;
  fields: { label: string; value: string }[];
}) {
  return (
    <div className="min-w-0 space-y-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <dl className="space-y-4">
        {fields.map(({ label, value }) => (
          <div
            key={label}
            className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-x-4"
          >
            <dt className="text-[13px] leading-6 text-muted-foreground">
              {label}
            </dt>
            <dd className="min-w-0 break-words text-sm leading-6">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function OrderTradeSummary({
  full,
  list,
  retrievedAt,
}: {
  full: Order;
  list: ListOrder;
  retrievedAt: number;
}) {
  const witness = full.order.witness;
  const summary = list.metadata.chunkSummary;
  const count = (value: unknown) => {
    const number = reportedNumber(value);
    return number !== undefined && Number.isSafeInteger(number) && number >= 0
      ? number
      : undefined;
  };
  const planned = count(full.metadata.expectedChunks);
  const completed = count(summary.success);
  const remaining =
    planned !== undefined && completed !== undefined && completed <= planned
      ? planned - completed
      : undefined;
  const errors = count(executionErrorCount(list));
  const progressKnown = remaining !== undefined && planned! > 0;
  const active = getOverviewOrderStatus(list) === "active";
  const nextEligible = reportedScheduleValue(full.metadata.nextEligibleTime);
  const nextPriceCheck = reportedScheduleValue(
    full.metadata.displayOnlyPriceCheckNextTime,
  );
  const latest = sortedOrderChunks(full.metadata.chunks ?? [])[0];
  const nextRetry = reportedScheduleValue(latest?.displayOnlyBackoffNextTime);
  const interval = reportedNumber(witness.epoch);
  const slippage = reportedNumber(witness.slippage);
  const date = (value: unknown) => formatOrderDate(reportedTime(value));
  const schedule = [
    { label: "Placed", value: date(full.timestamp) },
    ...(witness.start && reportedTime(witness.start)
      ? [{ label: "Scheduled start", value: date(witness.start) }]
      : []),
    { label: "Deadline", value: date(witness.deadline) },
    {
      label: "Trade interval",
      value:
        interval === undefined || interval < 0
          ? "Not reported"
          : interval > 0
            ? formatDuration(interval)
            : "No fixed interval",
    },
  ];
  const checks = [
    {
      label: "Slippage tolerance",
      value:
        slippage === undefined || slippage < 0
          ? "Not reported"
          : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(slippage / 100)}%`,
    },
    ...(reportedTime(full.metadata.lastPriceCheck)
      ? [
          {
            label: "Last price check",
            value: date(full.metadata.lastPriceCheck),
          },
        ]
      : []),
    ...(active
      ? [
          { kind: "eligible" as const, value: nextEligible },
          { kind: "price" as const, value: nextPriceCheck },
          { kind: "retry" as const, value: nextRetry },
        ]
          .filter(({ value }) => value)
          .map(({ kind, value }) => ({
            label: orderScheduleLabel(kind, value, retrievedAt),
            value: date(value),
          }))
      : []),
  ];

  return (
    <section
      aria-label="Trades and schedule"
      className="space-y-7 rounded-xl bg-card p-5 sm:p-6"
    >
      <h3 className="text-base font-semibold">Trade progress</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-[13px] leading-5 text-muted-foreground">
            Trades completed
          </dt>
          <dd className="mt-2 break-words text-2xl font-semibold tabular-nums">
            {completed === undefined ? (
              <span className="text-sm font-normal text-muted-foreground">
                Not reported
              </span>
            ) : (
              completed.toLocaleString()
            )}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              {" "}
              {planned === undefined
                ? "· planned count not reported"
                : `of ${planned.toLocaleString()} planned`}
            </span>
            {progressKnown && (
              <div
                role="progressbar"
                aria-label="Successful trades"
                aria-valuenow={completed}
                aria-valuemin={0}
                aria-valuemax={planned}
                aria-valuetext={`${completed} of ${planned} trades completed`}
                className="mt-3 max-w-56"
              >
                <Progress
                  progress={(completed! / planned!) * 100}
                  className="h-1.5 bg-muted"
                />
              </div>
            )}
          </dd>
        </div>
        {[
          {
            label: active ? "Pending trades" : "Unfilled trades",
            value: remaining,
            error: false,
          },
          { label: "Execution errors", value: errors, error: Boolean(errors) },
          {
            label: "Execution records",
            value: full.metadata.chunks?.length ?? 0,
            error: false,
          },
        ].map(({ label, value, error }) => (
          <div key={label} className="min-w-0">
            <dt className="text-[13px] leading-5 text-muted-foreground">
              {label}
            </dt>
            <dd
              className={`mt-2 text-2xl font-semibold tabular-nums ${error ? "text-destructive" : ""}`}
            >
              {value === undefined ? (
                <span className="text-sm font-normal text-muted-foreground">
                  Not reported
                </span>
              ) : (
                value.toLocaleString()
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-x-12 gap-y-7 lg:grid-cols-2">
        <ScheduleFields title="Schedule" fields={schedule} />
        <ScheduleFields title="Execution checks" fields={checks} />
      </div>
    </section>
  );
}
