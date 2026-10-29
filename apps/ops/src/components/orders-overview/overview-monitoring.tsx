"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@orbs/ui/controls/table";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Network } from "@orbs/ui/controls/network";
import { Button } from "@orbs/ui/controls/button";
import { ChartSkeleton } from "@/components/loading-skeletons";
import { Panel } from "@/components/operations/primitives";
import { useOperationsData } from "@/components/operations/operations-view";
import { ViewTabs } from "@/components/view-tabs";
import {
  buildOverviewSignals,
  buildRecentActivity,
} from "@/lib/overview-monitoring";
import { useMonitoringRules } from "./monitoring-rules";
import { useQueryParam, StringParam } from "use-query-params";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
import { attentionOrdersHref } from "@/lib/attention-queue";

const ActivityChart = dynamic(() => import("./overview-activity-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const inspectClass =
  "inline-flex min-h-8 items-center gap-1 rounded text-xs text-link enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground";

export function OverviewMonitoring() {
  const {
    orders,
    partnerCards,
    lastOrderByPartner,
    activityPartners,
    updatedAt,
    isLoading,
    isError,
    retry,
    inspectOrders,
    scope,
  } = useOperationsData();
  const { rules } = useMonitoringRules();
  const [pulseWindow, setPulseWindow] = useQueryParam(
    "pulse_window",
    StringParam,
  );
  const windowHours = pulseWindow === "168" ? 168 : 24;
  const data = useMemo(
    () =>
      buildOverviewSignals({
        orders,
        partnerCards,
        snapshot: updatedAt,
        rules,
        lastOrderByPartner,
        activityPartners,
      }),
    [
      orders,
      partnerCards,
      updatedAt,
      rules,
      lastOrderByPartner,
      activityPartners,
    ],
  );
  const recent = useMemo(
    () => buildRecentActivity(orders, updatedAt, windowHours),
    [orders, updatedAt, windowHours],
  );
  if (isLoading || isError)
    return (
      <Panel
        title="Operational pulse"
        description="Order processing is assessed separately from API connectivity."
      >
        <div
          role={isError ? "alert" : undefined}
          className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-sm"
        >
          {isError ? (
            <>
              <p>
                Order signals are unavailable because complete history could not
                be loaded.
              </p>
              <Button variant="outline" onClick={retry}>
                Try again
              </Button>
            </>
          ) : (
            <ChartSkeleton label="Loading order activity" />
          )}
        </div>
      </Panel>
    );
  const windowLabel = windowHours === 24 ? "Last 24 hours" : "Last 7 days";
  const chart = (measure: "activity" | "rates") => (
    <div className="space-y-2">
      {recent.orders.length ? (
        <ActivityChart
          buckets={recent.buckets}
          measure={measure}
          inspect={inspectOrders}
        />
      ) : (
        <p className="flex h-36 items-center justify-center rounded-lg bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          No orders were placed in this recent window. Broaden the filters or
          review the full order list.
        </p>
      )}
    </div>
  );
  return (
    <Panel
      title="Operational pulse"
      action={
        <Select
          value={String(windowHours)}
          onValueChange={(value) =>
            setPulseWindow(value === "24" ? undefined : value, "replaceIn")
          }
        >
          <SelectTrigger
            aria-label="Operational pulse window"
            className="h-8 w-40 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24">Pulse · last 24h</SelectItem>
            <SelectItem value="168">Pulse · last 7d</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <ViewTabs
        label="Order monitoring views"
        param="overview_signal_view"
        className="gap-2"
        tabs={[
          { value: "activity", label: "Activity", content: chart("activity") },
          { value: "rates", label: "Failure rate", content: chart("rates") },
          {
            value: "networks",
            label: "Networks",
            content: (
              <div className="space-y-2">
                {data.networks.length ? (
                  <div className="max-h-64 overflow-auto rounded-lg">
                    <Table
                      containerProps={{ className: "overflow-visible" }}
                      className="w-full text-left text-xs tabular-nums"
                    >
                      <TableHeader className="sticky top-0 bg-card text-[11px] text-muted-foreground">
                        <TableRow>
                          <TableHead scope="col" className="p-2">
                            Network
                          </TableHead>
                          <TableHead scope="col" className="p-2 text-left">
                            Orders
                          </TableHead>
                          <TableHead scope="col" className="p-2 text-left">
                            Failed
                          </TableHead>
                          <TableHead scope="col" className="p-2 text-left">
                            Latest attempt failed
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.networks.map((network) => (
                          <TableRow
                            key={network.chainId}
                            className="border-t border-border"
                          >
                            <TableHead
                              scope="row"
                              className="p-2 text-left font-normal"
                            >
                              <Network
                                chainId={network.chainId}
                                variant="inline"
                                showChainId={false}
                                data={
                                  network.chainId === 0
                                    ? { name: "Network not provided" }
                                    : undefined
                                }
                              />
                            </TableHead>
                            <TableCell className="p-2 text-left">
                              <Link
                                prefetch={false}
                                href={attentionOrdersHref(
                                  scope,
                                  {},
                                  scope.partnerIds,
                                  [String(network.chainId)],
                                )}
                                className={inspectClass}
                              >
                                {network.orders.length}
                              </Link>
                            </TableCell>
                            <TableCell className="p-2 text-left">
                              <Link
                                prefetch={false}
                                href={attentionOrdersHref(
                                  scope,
                                  { order_status: "failed" },
                                  scope.partnerIds,
                                  [String(network.chainId)],
                                )}
                                className={inspectClass}
                              >
                                {network.failed.length}
                              </Link>
                            </TableCell>
                            <TableCell className="p-2 text-left">
                              <Link
                                prefetch={false}
                                href={attentionOrdersHref(
                                  scope,
                                  { order_errors: "latest" },
                                  scope.partnerIds,
                                  [String(network.chainId)],
                                )}
                                className={inspectClass}
                              >
                                {network.latestErrors.length}
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No network activity in this view.
                  </p>
                )}
              </div>
            ),
          },
        ]}
      />
    </Panel>
  );
}
