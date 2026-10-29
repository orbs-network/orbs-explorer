"use client";

import { useMemo } from "react";
import { EventListSkeleton } from "@/components/loading-skeletons";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { groupOverviewOrders } from "@orbs/domain/twap/utils/orders-overview";
import { useOperationsData } from "@/components/operations/operations-view";
import { EmptyState, Panel } from "@/components/operations/primitives";
import { formatOrderUsd } from "@/components/orders-overview/overview-display";
import { buildOrderDiagnostics } from "@/lib/order-diagnostics";
import { buildActiveOrderAttention } from "@/lib/attention-queue";
import { useOperationalScope } from "@/hooks/use-operational-scope";
import { OperationalScopeControl } from "@/components/operations/operational-scope-control";
import {
  partnerOrdersHref,
  partnerOrdersTabHref,
} from "@/lib/partner-navigation";
import { PartnerNetworks } from "./partner-networks";
import { PartnerActivity } from "./partner-activity";

export function PartnerOverview({ partnerId }: { partnerId: string }) {
  const reporting = useOperationsData();
  const { orders, updatedAt } = reporting;
  const operational = useOperationalScope(reporting, reporting.scope);
  const search = useSearchParams().toString();
  const data = useMemo(
    () => ({
      diagnostics: buildOrderDiagnostics(orders, updatedAt),
      groups: groupOverviewOrders(orders),
    }),
    [orders, updatedAt],
  );
  const attention = buildActiveOrderAttention(
    operational.data.orders,
    updatedAt,
    operational.scope,
  );
  const attentionCount = new Set(attention.flatMap((item) => item.orders)).size;
  const placedValue = data.diagnostics.types.reduce(
    (sum, type) => sum + type.value,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
        <Link
          href={partnerOrdersHref(partnerId, search)}
          prefetch={false}
          className="rounded font-medium text-foreground hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {orders.length.toLocaleString()} orders in this view
        </Link>
        <span
          title={`${data.diagnostics.pricedOrders}/${orders.length} orders report USD. Placed sizes, not executed volume.`}
        >
          Placed value{" "}
          <strong className="font-medium text-foreground">
            {data.diagnostics.pricedOrders || !orders.length
              ? formatOrderUsd(placedValue)
              : "—"}
          </strong>
        </span>
      </div>
      {!orders.length ? (
        <EmptyState description="No orders were placed in the selected period and networks. Inactivity alone does not indicate an execution issue." />
      ) : null}
      <Panel
        title={
          operational.data.isLoading
            ? "Open orders to review"
            : `Open orders to review (${attentionCount})`
        }
        description="Past deadline, failed latest attempt, or missing deadline. Each order is counted once; these signals do not confirm an outage."
        action={
          <Link
            href={partnerOrdersHref(partnerId, search, { errors: "any" })}
            scroll={false}
            className="inline-flex min-h-9 items-center gap-1 rounded-sm text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Orders with errors
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        }
      >
        <div className="mb-3">
          <OperationalScopeControl
            {...operational}
            period={reporting.scope.period}
            isLoading={operational.data.isLoading}
            isUnavailable={operational.data.isError}
          />
        </div>
        {operational.data.isLoading && (
          <EventListSkeleton label="Loading active orders" />
        )}
        {operational.data.isError && (
          <p role="alert" className="text-xs text-destructive">
            Active orders could not be loaded.
          </p>
        )}
        {!operational.data.isLoading &&
          !operational.data.isError &&
          attentionCount === 0 && (
            <p className="mb-2 text-xs text-muted-foreground">
              No actionable issues detected under these rules.
            </p>
          )}
        <div className="divide-y divide-border/60">
          {attention.map((item) => (
            <Link
              key={item.id}
              href={partnerOrdersTabHref(partnerId, {
                query: item.href.split("?")[1],
              })}
              prefetch={false}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left text-xs hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block font-medium">{item.title}</span>
                <span className="mt-1 block text-[10px] leading-relaxed text-muted-foreground">
                  {item.detail}
                </span>
              </span>
              <span
                className={`inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums ${item.orders.length ? "text-destructive" : "text-muted-foreground"}`}
              >
                {item.orders.length.toLocaleString()}
                <ChevronRight aria-hidden className="size-3" />
              </span>
            </Link>
          ))}
        </div>
        {data.groups.failed.length > 0 && (
          <Link
            href={partnerOrdersHref(partnerId, search, { status: "failed" })}
            prefetch={false}
            className="mt-3 block rounded border-t border-border pt-3 text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {data.groups.failed.length} terminal failures in the reporting
            placement period
          </Link>
        )}
      </Panel>
      <PartnerActivity />
      <PartnerNetworks partnerId={partnerId} />
    </div>
  );
}
