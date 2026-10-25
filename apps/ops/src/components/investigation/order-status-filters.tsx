"use client";

import { useId } from "react";
import { InfoHint } from "@/components/info-hint";
import { AlertTriangle } from "lucide-react";
import {
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import type { InvestigationFilters } from "@/lib/order-investigation";
import type { buildOrderFacets } from "@/lib/order-quick-views";
import { cn } from "@orbs/domain/utils/utils";

const statuses: OverviewOrderStatus[] = [
  "failed",
  "active",
  "partial",
  "cancelled",
  "expired",
  "completed",
  "unknown",
];
export function OrderStatusFilters({
  facets,
  filters,
  onChange,
}: {
  facets: ReturnType<typeof buildOrderFacets>;
  filters: InvestigationFilters;
  onChange: (filters: InvestigationFilters) => void;
}) {
  const chip =
    "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [@media(pointer:coarse)]:min-h-11";
  const id = useId();
  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Filter orders by status"
        className="flex gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
      >
        <button
          type="button"
          aria-pressed={filters.status === "all"}
          onClick={() => onChange({ ...filters, status: "all" })}
          className={cn(
            chip,
            filters.status === "all"
              ? "bg-foreground font-medium text-background hover:bg-foreground/90"
              : "bg-control-background text-muted-foreground hover:bg-control-hover",
          )}
        >
          All <span>{facets.all.toLocaleString()}</span>
        </button>
        {statuses
          .filter(
            (status) =>
              status !== "unknown" ||
              facets.counts.unknown > 0 ||
              filters.status === "unknown",
          )
          .map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filters.status === status}
              disabled={!facets.counts[status] && filters.status !== status}
              onClick={() =>
                onChange({
                  ...filters,
                  status,
                })
              }
              className={cn(
                chip,
                "disabled:cursor-default disabled:opacity-50",
                filters.status === status
                  ? "bg-foreground font-medium text-background hover:bg-foreground/90"
                  : "bg-control-background text-muted-foreground hover:bg-control-hover",
                status === "failed" &&
                  facets.counts.failed > 0 &&
                  filters.status !== status &&
                  "text-destructive",
              )}
            >
              {OVERVIEW_STATUSES[status].label}{" "}
              <span>{facets.counts[status].toLocaleString()}</span>
              {status === "active" && facets.activeErroring > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px]",
                    filters.status === "active"
                      ? "text-background"
                      : "text-destructive",
                  )}
                  title="Active orders whose latest attempt reports an error"
                >
                  <AlertTriangle aria-hidden className="size-3" />
                  {facets.activeErroring} latest failed
                </span>
              )}
            </button>
          ))}
      </div>
      <div
        role="group"
        aria-label="Execution error filters"
        className="space-y-1.5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-xs font-medium">
            Execution signals
          </label>
          <InfoHint>
            An execution error can occur on an active, completed, cancelled, or
            expired order. Error history is not an additional terminal outcome.
          </InfoHint>
          <select
            id={id}
            aria-label="Execution error filter"
            value={filters.errors}
            onChange={(event) =>
              onChange({
                ...filters,
                errors: event.target.value as InvestigationFilters["errors"],
              })
            }
            className="h-10 min-w-0 max-w-full rounded-md bg-control-background px-3 text-xs text-foreground"
          >
            <option value="all">Any execution history</option>
            <option value="any">
              Has execution errors ({facets.withErrors})
            </option>
            <option value="latest">Latest attempt failed</option>
            <option value="recovered">Completed after errors</option>
            <option value="none">Zero reported errors</option>
            <option value="unreported">Error count unavailable</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          Execution signals can overlap current outcomes.
        </p>
      </div>
    </div>
  );
}
