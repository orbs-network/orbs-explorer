"use client";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ActiveReviewQueue } from "./active-review-queue";
import { useOperationsData } from "@/components/operations/operations-view";
import {
  EmptyState,
  Metric,
  MetricGrid,
  Panel,
} from "@/components/operations/primitives";
import {
  buildExecutionHealth,
  deadlineTime,
  placementTime,
} from "@/lib/execution-analytics";
import { hasLastExecutionError } from "@/lib/order-diagnostics";
import { CohortRows } from "./execution-ui";

export function ExecutionHealth() {
  const { orders, updatedAt } = useOperationsData();
  const data = useMemo(
    () => buildExecutionHealth(orders, updatedAt),
    [orders, updatedAt],
  );
  const search = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const view = search.get("review_filter") ?? "review";
  const options = [
    { value: "review", label: "Needs review", orders: data.attention },
    { value: "all", label: "All currently active", orders: data.active },
    {
      value: "past",
      label: "Past deadline",
      orders: data.active.filter(
        (o) => (deadlineTime(o) ?? Infinity) <= updatedAt,
      ),
    },
    {
      value: "latest",
      label: "Latest attempt failed",
      orders: data.lastErrors,
    },
    {
      value: "soon",
      label: "Deadline within 1 hour",
      orders: data.deadlines[1].orders,
    },
    {
      value: "older",
      label: "Placed more than 24 hours ago",
      orders: data.active.filter((o) => {
        const t = placementTime(o);
        return t !== undefined && updatedAt - t >= 86400000;
      }),
    },
  ];
  const selected =
    options.find((option) => option.value === view) ?? options[0];
  if (!orders.length) return <EmptyState />;
  return (
    <div className="space-y-5">
      <MetricGrid>
        <Metric
          label="Currently active orders"
          value={data.active.length}
          orders={data.active}
        />
        <Metric
          label="Active past deadline"
          value={data.deadlines[0].orders.length}
          orders={data.deadlines[0].orders}
          tone="warning"
        />
        <Metric
          label="Active · latest attempt failed"
          value={data.lastErrors.length}
          orders={data.lastErrors}
          tone="danger"
        />
        <Metric
          label="Deadline within 1 hour"
          value={data.deadlines[1].orders.length}
          orders={data.deadlines[1].orders}
        />
      </MetricGrid>
      <Panel
        title="Active order review"
        description="Past deadline, latest attempt failed, or missing deadline. Age alone does not prove a stall. Counts use the active-order scope shown above."
      >
        <label className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          Review filter
          <select
            aria-label="Review filter"
            value={selected.value}
            onChange={(event) => {
              const next = new URLSearchParams(search.toString());
              next.set("review_filter", event.target.value);
              next.delete("table_page_active_orders_to_review");
              router.push(`${pathname}?${next}`, { scroll: false });
            }}
            className="h-10 rounded-md bg-control-background px-3 text-foreground"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.orders.length})
              </option>
            ))}
          </select>
        </label>
        {selected.orders.length ? (
          <ActiveReviewQueue orders={selected.orders} />
        ) : (
          <EmptyState
            title="No active orders match this review filter"
            description="Choose another review filter to see the remaining active orders."
          />
        )}
      </Panel>
      <details className="rounded-xl bg-card p-4">
        <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
          Deadline, age, and waiting-state breakdowns
        </summary>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <section>
            <h2 className="mb-3 font-medium">Deadlines</h2>
            <CohortRows cohorts={data.deadlines} total={data.active.length} />
          </section>
          <section>
            <h2 className="mb-3 font-medium">Age since placement</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Age alone does not prove a stall.
            </p>
            <CohortRows cohorts={data.ages} total={data.active.length} />
          </section>
          <section>
            <h2 className="mb-3 font-medium">Waiting state</h2>
            <CohortRows cohorts={data.signals} total={data.active.length} />
          </section>
        </div>
      </details>
    </div>
  );
}
