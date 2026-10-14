"use client";

import type { ReactNode } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils/utils";
import type { ActivityStep, ActivityTone } from "@/lib/activity/order-story";

export function ActivitySummary({
  title,
  explanation,
  tone = "pending",
  reason,
  nextStep,
  steps,
  facts,
  actions,
  onRefresh,
  refreshing,
  children,
}: {
  title: string;
  explanation: string;
  tone?: ActivityTone;
  reason?: string;
  nextStep?: string;
  steps?: ActivityStep[];
  facts?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label="Activity status"
      className="min-w-0 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "text-lg font-semibold",
              tone === "success" &&
                "text-emerald-700 dark:text-emerald-400 [[data-theme=explorer]_&]:text-emerald-400",
              tone === "error" && "text-destructive",
              tone === "warning" &&
                "text-amber-700 dark:text-amber-400 [[data-theme=explorer]_&]:text-amber-400",
            )}
          >
            {title}
          </h2>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshing ? "Refreshing status" : "Refresh status"}
            title="Refresh status"
          >
            <RefreshCw
              aria-hidden
              className={cn(
                "size-3.5",
                refreshing && "motion-safe:animate-spin",
              )}
            />
            <span className="hidden sm:inline">
              {refreshing ? "Refreshing…" : "Refresh status"}
            </span>
          </Button>
        )}
      </div>
      <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">
        {explanation}
      </p>
      {reason && (
        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Latest update
          </p>
          <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">
            {reason}
          </p>
        </div>
      )}
      {steps && (
        <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="flex min-w-0 gap-2.5"
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs",
                  step.state === "done"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 [[data-theme=explorer]_&]:text-emerald-400"
                    : step.state === "current"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {step.state === "done" ? (
                  <Check className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {facts?.length ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="mt-1 break-words text-sm font-medium tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {nextStep && (
        <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next step: </span>
          {nextStep}
        </p>
      )}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

export function ActivityTime({
  value,
  precision = "minute",
}: {
  value?: string | number;
  precision?: "minute" | "second";
}) {
  if (!value) return <span>Not reported</span>;
  const date = new Date(
    typeof value === "number" && value < 1e12 ? value * 1000 : value,
  );
  if (!Number.isFinite(date.getTime())) return <span>Not reported</span>;
  return (
    <time dateTime={date.toISOString()} title={date.toISOString()}>
      {new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: precision === "second" ? "medium" : "short",
      }).format(date)}
    </time>
  );
}
