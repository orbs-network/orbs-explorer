"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  groupOverviewOrders,
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { useOperationsData } from "@/components/operations/operations-view";
import { EmptyState, Panel } from "@/components/operations/primitives";
import {
  formatShare,
  STATUS_COLORS,
} from "@/components/orders-overview/overview-display";
import { CHART_COLORS } from "@/components/charts/chart-colors";
import { partnerOrdersHref } from "@/lib/partner-navigation";

export function PartnerOutcomes({ partnerId }: { partnerId: string }) {
  const { orders } = useOperationsData();
  const search = useSearchParams().toString();
  const groups = useMemo(() => groupOverviewOrders(orders), [orders]);
  const outcomes = (
    Object.keys(OVERVIEW_STATUSES) as OverviewOrderStatus[]
  ).filter((status) => status !== "unknown" || groups.unknown.length);

  return (
    <Panel
      title="Order outcomes"
      description="Current statuses of orders placed in the selected period and networks. Select a status to inspect its orders."
    >
      {orders.length ? (
        <>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            {outcomes.map((status) =>
              groups[status].length ? (
                <span
                  key={status}
                  style={{
                    width: `${(groups[status].length / orders.length) * 100}%`,
                    background: CHART_COLORS[status],
                  }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 divide-y divide-border/60">
            {outcomes.map((status) => (
              <li key={status}>
                <Link
                  href={partnerOrdersHref(partnerId, search, { status })}
                  prefetch={false}
                  className="flex min-h-14 w-full items-center justify-between gap-4 rounded-sm px-1 py-3 text-left text-xs transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 rounded-sm"
                      style={{ background: CHART_COLORS[status] }}
                    />
                    {OVERVIEW_STATUSES[status].label}
                  </span>
                  <span className="flex items-center gap-4 tabular-nums">
                    <span className="text-[11px] text-muted-foreground">
                      {formatShare(groups[status].length, orders.length)}
                    </span>
                    <strong
                      className={`min-w-10 text-right text-sm font-semibold ${STATUS_COLORS[status]}`}
                    >
                      {groups[status].length.toLocaleString()}
                    </strong>
                    <ChevronRight
                      aria-hidden
                      className={`size-3 shrink-0 text-muted-foreground ${groups[status].length ? "" : "invisible"}`}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState description="Choose a longer period or different networks to see this partner’s order outcomes." />
      )}
    </Panel>
  );
}
