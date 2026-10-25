"use client";

import { useMemo, useState } from "react";
import type { ListOrder } from "@orbs/domain/twap/types";
import { Input } from "@orbs/ui/controls/input";
import { EmptyState } from "@/components/operations/primitives";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { useOperationsData } from "@/components/operations/operations-view";
import { summarizeCohort } from "@/lib/market-analytics";
import {
  formatOrderUsd,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { cellClass, inspectClass, NetworkLabel } from "./analytics-labels";
import { ViewTabs } from "@/components/view-tabs";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";

export type PerformanceCohort = {
  key: string;
  label: string;
  chainId?: number;
  orders: ListOrder[];
};
export function CohortTable({
  groups,
  label,
}: {
  groups: PerformanceCohort[];
  label: string;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("orders");
  const rows = useMemo(
    () =>
      groups
        .filter((group) => group.orders.length)
        .map((group) => ({ ...group, summary: summarizeCohort(group.orders) })),
    [groups],
  );
  const filtered = useMemo(
    () =>
      rows
        .filter((group) =>
          `${group.label} ${group.chainId ?? ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .sort((a, b) => {
          if (sort === "value")
            return (
              b.summary.value - a.summary.value ||
              a.label.localeCompare(b.label)
            );
          if (sort === "completed")
            return (
              b.summary.outcomes.completed.length / b.orders.length -
                a.summary.outcomes.completed.length / a.orders.length ||
              b.orders.length - a.orders.length
            );
          if (sort === "errors")
            return (
              b.summary.withErrors.length - a.summary.withErrors.length ||
              b.orders.length - a.orders.length
            );
          return (
            b.orders.length - a.orders.length || a.label.localeCompare(b.label)
          );
        }),
    [rows, search, sort],
  );
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          type="search"
          name={`${label.toLowerCase().replaceAll(" ", "-")}-search`}
          autoComplete="off"
          spellCheck={false}
          aria-label={`Search ${label}`}
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          className="min-w-40 flex-1"
        />
        <div className="w-full sm:w-48">
          <InvestigationSelect
            label={`Sort ${label.toLowerCase()} by`}
            hideLabel
            value={sort}
            onChange={(value) => {
              setSort(value);
            }}
          >
            <InvestigationSelectItem value="orders">
              Order count
            </InvestigationSelectItem>
            <InvestigationSelectItem value="value">
              Placed value
            </InvestigationSelectItem>
            <InvestigationSelectItem value="completed">
              Completed share
            </InvestigationSelectItem>
            <InvestigationSelectItem value="errors">
              Orders with errors
            </InvestigationSelectItem>
          </InvestigationSelect>
        </div>
      </div>
      <p role="status" className="mb-3 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()}{" "}
        {filtered.length === 1
          ? label.toLowerCase().replace(/s$/, "")
          : label.toLowerCase()}
        {search.trim()
          ? filtered.length === 1
            ? " matches your search"
            : " match your search"
          : " in this view"}
      </p>
      {filtered.length ? (
        <ViewTabs
          label={`${label} measures`}
          param="cohort_view"
          tabs={[
            {
              value: "outcomes",
              label: "Outcomes",
              content: (
                <CohortResults rows={filtered} label={label} mode="outcomes" />
              ),
            },
            {
              value: "sizes",
              label: "Order sizes",
              content: (
                <CohortResults rows={filtered} label={label} mode="sizes" />
              ),
            },
            {
              value: "errors",
              label: "Error history",
              content: (
                <CohortResults rows={filtered} label={label} mode="errors" />
              ),
            },
          ]}
        />
      ) : (
        <EmptyState
          title={`No matching ${label.toLowerCase()}`}
          description="Try a different search or adjust the global filters."
        />
      )}
    </div>
  );
}

function CohortResults({
  rows,
  label,
  mode,
}: {
  rows: (PerformanceCohort & { summary: ReturnType<typeof summarizeCohort> })[];
  label: string;
  mode: "outcomes" | "sizes" | "errors";
}) {
  const { inspectOrders } = useOperationsData();
  // An all-zero Unknown column is noise; show it only when some order needs it.
  const showUnknown = rows.some((row) => row.summary.outcomes.unknown.length);
  return (
    <ContinuousTable
      label={`${label} ${mode === "outcomes" ? "outcomes" : mode === "sizes" ? "order sizes" : "error history"}`}
      items={rows}
      itemKey={(row) => row.key}
      minWidth={mode === "outcomes" ? 880 : mode === "sizes" ? 760 : 420}
      header={
        <tr>
          {[
            label,
            "Orders",
            ...(mode === "outcomes"
              ? [
                  "Completed / all",
                  "Partial",
                  "Active",
                  "Cancelled",
                  "Expired",
                  "Failed",
                  ...(showUnknown ? ["Unknown"] : []),
                ]
              : mode === "sizes"
                ? [
                    "Placed value",
                    "Mean size",
                    "Median size",
                    "P90 size",
                    "USD coverage",
                  ]
                : ["With errors"]),
          ].map((heading) => (
            <th
              scope="col"
              key={heading}
              className={`${cellClass} font-medium text-muted-foreground`}
            >
              {heading}
            </th>
          ))}
        </tr>
      }
      rowContent={(row) => {
        const { summary } = row;
        return (
          <>
            <th scope="row" className={cellClass}>
              <button
                type="button"
                className={`${inspectClass} font-medium`}
                onClick={() => inspectOrders(row.label, row.orders)}
              >
                {row.chainId !== undefined ? (
                  <NetworkLabel chainId={row.chainId} />
                ) : (
                  row.label
                )}
              </button>
            </th>
            <td className={cellClass}>
              <button
                type="button"
                className={inspectClass}
                onClick={() => inspectOrders(row.label, row.orders)}
              >
                {row.orders.length.toLocaleString()}
              </button>
            </td>
            {mode === "outcomes" ? (
              <>
                <td className={cellClass}>
                  <button
                    type="button"
                    disabled={!summary.outcomes.completed.length}
                    className={`${inspectClass} text-success`}
                    onClick={() =>
                      inspectOrders(
                        `${row.label} · completed`,
                        summary.outcomes.completed,
                      )
                    }
                  >
                    {formatShare(
                      summary.outcomes.completed.length,
                      row.orders.length,
                    )}
                    <span className="block text-[10px] text-muted-foreground">
                      {summary.outcomes.completed.length.toLocaleString()} /{" "}
                      {row.orders.length.toLocaleString()}
                    </span>
                  </button>
                </td>
                {(
                  [
                    "partial",
                    "active",
                    "cancelled",
                    "expired",
                    "failed",
                    ...(showUnknown ? (["unknown"] as const) : []),
                  ] as const
                ).map((status) => (
                  <td key={status} className={cellClass}>
                    <button
                      type="button"
                      disabled={!summary.outcomes[status].length}
                      className={`${inspectClass} ${status === "failed" && summary.outcomes.failed.length ? "text-destructive" : status === "active" && summary.outcomes.active.length ? "text-link" : ""}`}
                      onClick={() =>
                        inspectOrders(
                          `${row.label} · ${status}`,
                          summary.outcomes[status],
                        )
                      }
                    >
                      {summary.outcomes[status].length.toLocaleString()}
                    </button>
                  </td>
                ))}
              </>
            ) : mode === "sizes" ? (
              <>
                <td className={cellClass}>
                  <button
                    type="button"
                    className={inspectClass}
                    onClick={() => inspectOrders(row.label, row.orders)}
                  >
                    {formatOrderUsd(summary.value)}
                  </button>
                </td>
                {[summary.mean, summary.median, summary.p90].map(
                  (value, index) => (
                    <td key={index} className={cellClass}>
                      {value === undefined ? "—" : formatOrderUsd(value)}
                    </td>
                  ),
                )}
                <td className={`${cellClass} text-muted-foreground`}>
                  {formatShare(summary.pricedCount, row.orders.length)}
                  <span className="block text-[10px]">
                    {summary.pricedCount.toLocaleString()} /{" "}
                    {row.orders.length.toLocaleString()}
                  </span>
                </td>
              </>
            ) : (
              <>
                <td className={cellClass}>
                  <button
                    type="button"
                    disabled={!summary.withErrors.length}
                    className={`${inspectClass} ${summary.withErrors.length ? "text-amber-700 dark:text-amber-400" : ""}`}
                    onClick={() =>
                      inspectOrders(
                        `${row.label} · execution errors`,
                        summary.withErrors,
                      )
                    }
                  >
                    {summary.withErrors.length.toLocaleString()}
                    <span className="block text-[10px] text-muted-foreground">
                      {formatShare(
                        summary.withErrors.length,
                        row.orders.length,
                      )}
                    </span>
                  </button>
                </td>
              </>
            )}
          </>
        );
      }}
    />
  );
}
