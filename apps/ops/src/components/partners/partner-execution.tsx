"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Network } from "@orbs/ui/controls/network";
import { SelectionFilter } from "@/components/selection-filter";
import { useSelectionFilter } from "@/hooks/use-selection-filter";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  RankingPagination,
  RANKING_PAGE_SIZE,
} from "@/components/analytics/ranking-pagination";
import {
  formatDuration,
  inspectClass,
} from "@/components/execution/execution-ui";
import { useOperationsData } from "@/components/operations/operations-view";
import {
  EmptyState,
  Panel,
  TableFrame,
} from "@/components/operations/primitives";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import {
  buildExecutionHealth,
  deadlineTime,
  placementTime,
} from "@/lib/execution-analytics";
import {
  hasExecutionErrors,
  hasLastExecutionError,
  reportedNumber,
} from "@/lib/order-diagnostics";
import { orderDetailHref } from "@/lib/order-investigation";

type Health = ReturnType<typeof buildExecutionHealth>;

function OrderReference({
  order,
  networks,
}: {
  order: ListOrder;
  networks: Map<number, string>;
}) {
  const { scope } = useOperationsData();
  const chainId = getTwapOrderChainId(order);
  return (
    <>
      <Link
        href={orderDetailHref(order.hash, order.source, scope)}
        aria-label={`View order ${order.hash}`}
        className={`${inspectClass} font-mono text-xs hover:underline`}
      >
        {order.hash.slice(0, 8)}…{order.hash.slice(-6)}
      </Link>
      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
        <Network
          chainId={chainId}
          data={{
            id: chainId,
            name: chainId ? networks.get(chainId) : undefined,
          }}
          variant="inline"
          showChainId={false}
        />
        {" · "}
        {order.metadata.orderType || "Type unavailable"}
      </span>
    </>
  );
}

function queueCohorts(data: Health) {
  return [
    { id: "review", label: "Needs review", orders: data.attention },
    { id: "all", label: "All active orders", orders: data.active },
    { id: "past", label: "Past deadline", orders: data.deadlines[0].orders },
    {
      id: "hour",
      label: "Deadline within 1 hour",
      orders: data.deadlines[1].orders,
    },
    {
      id: "errors",
      label: "With error history",
      orders: data.activeWithErrors,
    },
    { id: "age", label: "At least 24 hours old", orders: data.oldOrders },
    ...data.signals.map((cohort) => ({
      id: cohort.id,
      label: cohort.label,
      orders: cohort.orders,
    })),
  ];
}

export function PartnerExecutionHealth() {
  const { orders, updatedAt, networkActivity, inspectOrders } =
    useOperationsData();

  const [pageIndex, setPage] = useState(0);
  const health = useMemo(
    () => buildExecutionHealth(orders, updatedAt),
    [orders, updatedAt],
  );
  const networks = useMemo(
    () =>
      new Map(
        networkActivity.map((network) => [network.chainId, network.chainName]),
      ),
    [networkActivity],
  );
  const cohorts = queueCohorts(health);
  const [cohortId, setCohortId] = useSelectionFilter(
    "queue_cohort",
    "review",
    cohorts.map((cohort) => cohort.id),
  );
  const selected =
    cohorts.find((cohort) => cohort.id === cohortId) ?? cohorts[0];
  const page = Math.min(
    pageIndex,
    Math.max(0, Math.ceil(selected.orders.length / RANKING_PAGE_SIZE) - 1),
  );
  const visible = selected.orders.slice(
    page * RANKING_PAGE_SIZE,
    (page + 1) * RANKING_PAGE_SIZE,
  );

  return (
    <Panel
      title="Active order queue"
      description="Review past-deadline orders, failed latest attempts, or missing deadlines. Age and recovered errors are context only."
      action={
        <span className="text-xs text-muted-foreground tabular-nums">
          {health.active.length.toLocaleString()} active ·{" "}
          {health.attention.length.toLocaleString()} to review
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SelectionFilter
          label="Queue filters"
          fieldLabel="Active orders"
          value={cohortId}
          options={cohorts.map((cohort) => ({
            value: cohort.id,
            label: `${cohort.label} (${cohort.orders.length.toLocaleString()})`,
          }))}
          onChange={(next) => {
            setCohortId(next);
            setPage(0);
          }}
        />
        <button
          type="button"
          disabled={!selected.orders.length}
          className={`${inspectClass} py-2 text-xs`}
          onClick={() => inspectOrders(selected.label, selected.orders)}
        >
          Inspect selection ({selected.orders.length.toLocaleString()})
        </button>
      </div>
      {visible.length ? (
        <TableFrame label="Partner active order queue">
          <thead>
            <tr>
              {[
                "Order / network",
                "Review signals",
                "Waiting state",
                "Age",
                "Deadline",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => {
              const placed = placementTime(order);
              const age =
                placed !== undefined && placed <= updatedAt
                  ? updatedAt - placed
                  : undefined;
              const deadline = deadlineTime(order);
              const flags = [
                deadline !== undefined && deadline <= updatedAt
                  ? "Past deadline"
                  : deadline !== undefined && deadline <= updatedAt + 3_600_000
                    ? "Deadline within 1h"
                    : undefined,
                deadline === undefined ? "Deadline unreported" : undefined,
                hasLastExecutionError(order)
                  ? "Latest attempt failed"
                  : hasExecutionErrors(order)
                    ? "Earlier errors"
                    : undefined,
                age !== undefined && age >= 86_400_000
                  ? "Age ≥24h"
                  : undefined,
              ].filter(Boolean);
              const waiting =
                health.signals.find((cohort) => cohort.orders.includes(order))
                  ?.label ?? "Other active";
              return (
                <tr
                  key={`${order.source}:${getTwapOrderChainId(order)}:${order.hash}`}
                  className="hover:bg-muted/20"
                >
                  <th scope="row">
                    <OrderReference order={order} networks={networks} />
                  </th>
                  <td className="min-w-40">
                    <span className="flex flex-wrap gap-1">
                      {flags.length ? (
                        flags.map((flag) => (
                          <span
                            key={flag}
                            className="rounded bg-muted px-1.5 py-1 text-[10px]"
                          >
                            {flag}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          No review signals
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {waiting}
                  </td>
                  <td className="whitespace-nowrap">{formatDuration(age)}</td>
                  <td className="whitespace-nowrap">
                    {formatOrderDate(deadline)}
                    {deadline !== undefined && (
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {deadline <= updatedAt
                          ? `${formatDuration(updatedAt - deadline)} past`
                          : `in ${formatDuration(deadline - updatedAt)}`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      ) : (
        <EmptyState
          title={
            health.active.length
              ? "No active orders match this view"
              : "No active orders"
          }
          description={
            health.active.length
              ? "Choose another queue to review other active orders."
              : "Change networks or broaden an explicitly selected placement period to look for active orders."
          }
        />
      )}
      <RankingPagination
        label="active orders"
        total={selected.orders.length}
        page={page}
        onPage={setPage}
      />
    </Panel>
  );
}

export function PartnerExecutionProgress() {
  const { orders, updatedAt, networkActivity, inspectOrders } =
    useOperationsData();
  const [scope, setScope] = useSelectionFilter("progress_scope", "active", [
    "active",
    "all",
  ]);
  const [pageIndex, setPage] = useState(0);
  const health = useMemo(
    () => buildExecutionHealth(orders, updatedAt),
    [orders, updatedAt],
  );
  const networks = useMemo(
    () =>
      new Map(
        networkActivity.map((network) => [network.chainId, network.chainName]),
      ),
    [networkActivity],
  );
  const selection = scope === "active" ? health.active : orders;
  const coverage = useMemo(
    () =>
      selection.reduce(
        (totals, order) => {
          const success = reportedNumber(order.metadata.chunkSummary?.success);
          const errors = reportedNumber(order.metadata.chunkSummary?.error);
          const planned = reportedNumber(order.metadata.expectedChunks);
          if (success !== undefined) {
            totals.success += success;
            totals.successCoverage++;
          }
          if (errors !== undefined) {
            totals.errors += errors;
            totals.errorCoverage++;
          }
          if (planned !== undefined) {
            totals.planned += planned;
            totals.plannedCoverage++;
          }
          return totals;
        },
        {
          success: 0,
          successCoverage: 0,
          errors: 0,
          errorCoverage: 0,
          planned: 0,
          plannedCoverage: 0,
        },
      ),
    [selection],
  );
  const page = Math.min(
    pageIndex,
    Math.max(0, Math.ceil(selection.length / RANKING_PAGE_SIZE) - 1),
  );
  const visible = selection.slice(
    page * RANKING_PAGE_SIZE,
    (page + 1) * RANKING_PAGE_SIZE,
  );

  return (
    <Panel
      title="Chunk progress"
      description="Reported successful, failed, and planned chunks per order. Failed chunk counts do not necessarily include every retry attempt."
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SelectionFilter
          label="Progress filters"
          fieldLabel="Orders"
          value={scope}
          options={[
            {
              value: "active",
              label: `Active orders (${health.active.length.toLocaleString()})`,
            },
            {
              value: "all",
              label: `All orders (${orders.length.toLocaleString()})`,
            },
          ]}
          onChange={(next) => {
            setScope(next);
            setPage(0);
          }}
        />
        <button
          type="button"
          disabled={!selection.length}
          className={`${inspectClass} py-2 text-xs`}
          onClick={() => inspectOrders("Chunk progress", selection)}
        >
          Inspect selection ({selection.length.toLocaleString()})
        </button>
      </div>
      <dl className="mb-4 grid grid-cols-3 divide-x divide-border border-y border-border py-3">
        {[
          {
            label: "Successful",
            value: coverage.success,
            count: coverage.successCoverage,
          },
          {
            label: "Failed",
            value: coverage.errors,
            count: coverage.errorCoverage,
          },
          {
            label: "Planned",
            value: coverage.planned,
            count: coverage.plannedCoverage,
          },
        ].map((metric) => (
          <div key={metric.label} className="px-3 first:pl-0">
            <dt className="text-[11px] text-muted-foreground">
              {metric.label}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {metric.count ? metric.value.toLocaleString() : "—"}
            </dd>
            <dd className="mt-1 text-[10px] text-muted-foreground">
              {metric.count}/{selection.length} orders reporting
            </dd>
          </div>
        ))}
      </dl>
      {visible.length ? (
        <TableFrame label="Partner chunk progress">
          <thead>
            <tr>
              {[
                "Order / network",
                "Successful",
                "Failed",
                "Planned",
                "Planned remaining",
                "Latest attempt",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => {
              const summary = order.metadata.chunkSummary;
              const success = reportedNumber(summary?.success);
              const errors = reportedNumber(summary?.error);
              const planned = reportedNumber(order.metadata.expectedChunks);
              const remaining =
                success !== undefined && planned !== undefined
                  ? Math.max(0, planned - success)
                  : undefined;
              return (
                <tr
                  key={`${order.source}:${getTwapOrderChainId(order)}:${order.hash}`}
                  className="hover:bg-muted/20"
                >
                  <th scope="row">
                    <OrderReference order={order} networks={networks} />
                  </th>
                  <td>{success?.toLocaleString() ?? "—"}</td>
                  <td>{errors?.toLocaleString() ?? "—"}</td>
                  <td>{planned?.toLocaleString() ?? "—"}</td>
                  <td>{remaining?.toLocaleString() ?? "—"}</td>
                  <td
                    className={
                      hasLastExecutionError(order)
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {summary?.lastChunkStatus || "Not provided"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableFrame>
      ) : (
        <EmptyState
          title={
            scope === "active" ? "No active orders" : "No orders in this view"
          }
          description={
            scope === "active"
              ? "Choose all orders to inspect completed and ended orders."
              : "Change the period or networks to inspect chunk progress."
          }
        />
      )}
      <RankingPagination
        label="orders"
        total={selection.length}
        page={page}
        onPage={setPage}
      />
    </Panel>
  );
}
