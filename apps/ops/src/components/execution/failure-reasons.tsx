"use client";

import { TableRow, TableHead, TableCell } from "@orbs/ui/controls/table";

import { Button } from "@orbs/ui/controls/button";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { StringParam, useQueryParams } from "use-query-params";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { Input } from "@orbs/ui/controls/input";
import { Badge } from "@orbs/ui/controls/badge";
import { FilterDrawer, type FilterBadge } from "@orbs/ui/filter-drawer";
import { useOperationsData } from "@/components/operations/operations-view";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { EmptyState, Panel } from "@/components/operations/primitives";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";
import {
  formatOrderDate,
  formatOrderUsd,
} from "@/components/orders-overview/overview-display";
import {
  buildFailureAnalytics,
  type FailureCohortId,
} from "@/lib/execution-analytics";
import {
  FAILURE_REASON_CATEGORIES,
  type FailureReasonCategory,
} from "@/lib/failure-classification";
import { orderReasonSummary } from "@/components/investigation/order-presentation";
import { InspectCount, inspectClass } from "./execution-ui";

const cohorts: { id: FailureCohortId; label: string }[] = [
  { id: "all", label: "All error signals" },
  { id: "terminal", label: "Failed orders" },
  { id: "latest", label: "Latest attempt errors" },
  { id: "active", label: "Active with error history" },
  { id: "completed", label: "Completed with error history" },
];
type Filters = {
  cohort: FailureCohortId;
  category: "all" | FailureReasonCategory;
};
const defaults: Filters = { cohort: "all", category: "all" };

function normalizeFailureGroups(
  source: ReturnType<typeof buildFailureAnalytics>["reasons"],
  category: "all" | FailureReasonCategory,
  query: string,
) {
  const groups = new Map<
    string,
    ReturnType<typeof buildFailureAnalytics>["reasons"][number] & {
      messages: string[];
    }
  >();
  for (const reason of source) {
    if (
      (category !== "all" && reason.category !== category) ||
      !reason.reason.toLowerCase().includes(query)
    )
      continue;
    const label = orderReasonSummary(reason.reason);
    const key = `${reason.category}:${label}`;
    const existing = groups.get(key);
    if (!existing)
      groups.set(key, {
        ...reason,
        reason: label,
        orders: [...reason.orders],
        terminal: [...reason.terminal],
        active: [...reason.active],
        completed: [...reason.completed],
        messages: [reason.reason],
      });
    else {
      existing.orders.push(...reason.orders);
      existing.terminal.push(...reason.terminal);
      existing.active.push(...reason.active);
      existing.completed.push(...reason.completed);
      existing.value += reason.value;
      existing.valueCoverage += reason.valueCoverage;
      existing.latestPlaced = Math.max(
        existing.latestPlaced ?? 0,
        reason.latestPlaced ?? 0,
      );
      existing.messages.push(reason.reason);
    }
  }
  return [...groups.values()].sort((a, b) => b.orders.length - a.orders.length);
}

/** Shared by global and partner failure views; consumes their existing scoped data. */
export function FailureReasons({
  orders,
  cohortParam = "error_cohort",
  categoryParam = "error_category",
}: {
  orders: ListOrder[];
  cohortParam?: string;
  categoryParam?: string;
}) {
  const { inspectOrders } = useOperationsData();
  const id = useId();
  const [queryParams, setParams] = useQueryParams({
    [cohortParam]: StringParam,
    [categoryParam]: StringParam,
  });
  const cohort =
    cohorts.find((item) => item.id === queryParams[cohortParam])?.id ?? "all";
  const category =
    FAILURE_REASON_CATEGORIES.find(
      (item) => item.id === queryParams[categoryParam],
    )?.id ?? "all";
  const value: Filters = { cohort, category };
  const apply = (next: Filters) =>
    setParams(
      {
        [cohortParam]: next.cohort === "all" ? undefined : next.cohort,
        [categoryParam]: next.category === "all" ? undefined : next.category,
      },
      "pushIn",
    );
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim().toLowerCase());
  const data = useMemo(() => buildFailureAnalytics(orders), [orders]);
  const selected = useMemo(
    () =>
      cohort === "all" ? data : buildFailureAnalytics(data.cohorts[cohort]),
    [data, cohort],
  );
  const reasons = useMemo(
    () => normalizeFailureGroups(selected.reasons, category, query),
    [selected.reasons, category, query],
  );
  const matchingOrders = useMemo(
    () => reasons.flatMap((reason) => reason.orders),
    [reasons],
  );
  const badges: FilterBadge[] = [];
  if (cohort !== "all")
    badges.push({
      key: "cohort",
      label: `Cohort: ${cohorts.find((item) => item.id === cohort)!.label}`,
      onRemove: () => apply({ ...value, cohort: "all" }),
    });
  if (category !== "all")
    badges.push({
      key: "category",
      label: `Category: ${FAILURE_REASON_CATEGORIES.find((item) => item.id === category)!.label}`,
      onRemove: () => apply({ ...value, category: "all" }),
    });
  return (
    <Panel
      title="Failure reasons"
      description="Grouped by a plain-language reported reason. Each order appears once in this table. Categories are text hints, not confirmed root causes."
    >
      <div className="flex flex-wrap items-end gap-3">
        <FilterDrawer
          label="Error filters"
          description="Choose an error cohort and a heuristic reason category. Page filters still apply."
          value={value}
          clearValue={defaults}
          badges={badges}
          onApply={apply}
          emptyLabel="All error signals · all reason categories"
        >
          {(draft, update) => (
            <>
              <InvestigationSelect
                label="Error cohort"
                value={draft.cohort}
                onChange={(next) =>
                  update({ ...draft, cohort: next as FailureCohortId })
                }
              >
                {cohorts.map((item) => (
                  <InvestigationSelectItem key={item.id} value={item.id}>
                    {item.label} (
                    {data.cohorts[item.id].length.toLocaleString()})
                  </InvestigationSelectItem>
                ))}
              </InvestigationSelect>
              <InvestigationSelect
                label="Reason category (heuristic)"
                value={draft.category}
                onChange={(next) =>
                  update({ ...draft, category: next as Filters["category"] })
                }
              >
                <InvestigationSelectItem value="all">
                  All reason categories
                </InvestigationSelectItem>
                {FAILURE_REASON_CATEGORIES.map((item) => (
                  <InvestigationSelectItem key={item.id} value={item.id}>
                    {item.label}
                  </InvestigationSelectItem>
                ))}
              </InvestigationSelect>
            </>
          )}
        </FilterDrawer>
        <div className="min-w-48 flex-1 space-y-1.5">
          <label htmlFor={`${id}-search`} className="sr-only">
            Search reported reasons
          </label>
          <Input
            id={`${id}-search`}
            name="failure_reason_search"
            type="search"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reasons, e.g. gas or liquidity…"
          />
        </div>
        <Button
          variant="ghost"
          size="content"
          type="button"
          disabled={!matchingOrders.length}
          className={`${inspectClass} min-h-10 text-xs`}
          onClick={() =>
            inspectOrders(
              "Matching failure reasons",
              matchingOrders,
              "Orders matching the error cohort, heuristic category, and reported reason search.",
            )
          }
        >
          Inspect matching orders ({matchingOrders.length.toLocaleString()})
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="my-3 text-xs text-muted-foreground"
      >
        {reasons.length.toLocaleString()} reason groups ·{" "}
        {matchingOrders.length.toLocaleString()} matching orders
      </p>
      {reasons.length ? (
        <ContinuousTable
          label="Failure reason groups"
          items={reasons}
          itemKey={(reason) => reason.reason}
          minWidth={800}
          header={
            <TableRow>
              {[
                "Reason category",
                "Orders",
                "Current outcomes",
                "Placed value (USD)",
                "Latest order placed",
              ].map((label) => (
                <TableHead key={label} scope="col">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          }
          rowContent={(reason) => {
            return (
              <>
                <TableHead
                  scope="row"
                  className="min-w-72 max-w-lg whitespace-normal! font-normal"
                >
                  {reason.category !== "other" && (
                    <Badge variant="outline" className="mb-1 text-[10px]">
                      {
                        FAILURE_REASON_CATEGORIES.find(
                          (item) => item.id === reason.category,
                        )!.label
                      }
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    title={reason.reason}
                    className="line-clamp-3 block w-full cursor-pointer rounded text-left text-xs leading-relaxed [overflow-wrap:anywhere] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      inspectOrders(
                        "Matching failure reason",
                        reason.orders,
                        reason.reason,
                      )
                    }
                  >
                    {reason.reason}
                  </Button>
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-ring">
                      Reported messages ({reason.messages.length})
                    </summary>
                    <ul className="mt-2 max-w-lg space-y-2 break-words">
                      {reason.messages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </details>
                </TableHead>
                <TableCell>
                  <InspectCount
                    orders={reason.orders}
                    label="Orders with matching failure reason"
                  />
                </TableCell>
                <TableCell className="min-w-36">
                  <div className="space-y-1 text-[11px]">
                    {[
                      { label: "Failed", orders: reason.terminal },
                      { label: "Active", orders: reason.active },
                      { label: "Completed", orders: reason.completed },
                      ...(
                        ["cancelled", "expired", "partial", "unknown"] as const
                      ).map((status) => ({
                        label: {
                          cancelled: "Cancelled",
                          expired: "Expired",
                          partial: "Partly completed",
                          unknown: "Unknown",
                        }[status],
                        orders: reason.orders.filter(
                          (order) => getOverviewOrderStatus(order) === status,
                        ),
                      })),
                    ]
                      .filter((outcome) => outcome.orders.length)
                      .map((outcome) => (
                        <div
                          key={outcome.label}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-muted-foreground">
                            {outcome.label}
                          </span>
                          <InspectCount
                            orders={outcome.orders}
                            label={`${outcome.label} orders with matching reason`}
                          />
                        </div>
                      ))}
                  </div>
                </TableCell>
                <TableCell
                  className="whitespace-nowrap"
                  title={`${reason.valueCoverage} of ${reason.orders.length} orders reporting USD`}
                >
                  {reason.valueCoverage ? formatOrderUsd(reason.value) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatOrderDate(reason.latestPlaced)}
                </TableCell>
              </>
            );
          }}
        />
      ) : (
        <EmptyState
          title={
            query || category !== "all"
              ? "No matching failure reasons"
              : "No error signals in this cohort"
          }
          description="Change the reason search, error filters, or page filters."
        />
      )}
    </Panel>
  );
}
