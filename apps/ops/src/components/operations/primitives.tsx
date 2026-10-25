"use client";

import { useId, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { InfoHint } from "@/components/info-hint";
import type { ListOrder } from "@orbs/domain/twap/types";
import { useOperationsData } from "./operations-view";

export function Panel({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`min-w-0 rounded-xl bg-card p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 id={id} className="font-semibold">
            {title}
          </h2>
          {description && <InfoHint>{description}</InfoHint>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
  );
}

export function Metric({
  label,
  value,
  note,
  orders,
  tone = "default",
}: {
  label: string;
  value: string | number;
  note?: string;
  orders?: ListOrder[];
  tone?: "default" | "warning" | "danger";
}) {
  const { inspectOrders } = useOperationsData();
  const content = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        {orders && orders.length > 0 && (
          <ChevronRight aria-hidden className="size-3.5 shrink-0" />
        )}
      </span>
      <strong
        className={`mt-2 block text-2xl font-semibold tracking-tight tabular-nums ${orders && !orders.length ? "text-muted-foreground" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-amber-800 dark:text-amber-300" : ""}`}
      >
        {value}
      </strong>
      {note && (
        <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">
          {note}
        </span>
      )}
    </>
  );
  // Flex keeps button tiles top-aligned like static ones.
  const base =
    "flex min-w-0 flex-col items-stretch justify-start rounded-xl bg-card p-4 text-left";
  return orders ? (
    <button
      type="button"
      disabled={!orders.length}
      onClick={() => inspectOrders(label, orders)}
      aria-label={`Inspect ${label.toLowerCase()} (${orders.length} orders)`}
      className={`${base} transition-colors enabled:hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default motion-reduce:transition-none`}
    >
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}

export function TableFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="min-w-0 overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table aria-label={label} className="ops-data-table">
        {children}
      </table>
    </div>
  );
}

export function EmptyState({
  title = "No orders in this view",
  description = "Try a different period, network, or trading app.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-8 text-center">
      <h3 className="font-medium">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
