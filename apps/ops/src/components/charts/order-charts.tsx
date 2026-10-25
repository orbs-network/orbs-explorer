"use client";

import { useMemo, useRef, useState } from "react";
import type { ListOrder } from "@orbs/domain/twap/types";
import type {
  PartnerCard,
  PartnerChainEntry,
} from "@orbs/domain/twap/utils/orders-overview";
import { getOrderValueUsd } from "@orbs/domain/twap/utils/orders-overview";
import { PARTNERS } from "@orbs/domain/partners";
import { getChainLogo } from "@orbs/domain/utils/utils";
import {
  buildOrderCharts,
  type ChartInterval,
  type OrderChartData,
} from "@/lib/order-charts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";
import { StatusOrdersModal } from "@/components/orders-overview/status-order-modal";
import { ChartFrame } from "./chart-frame";
import { RankedChart, type RankingMetric } from "./ranked-chart";
import { TimelineCharts } from "./timeline-charts";
import { ViewTabs } from "@/components/view-tabs";

const partnerLogos = new Map(
  PARTNERS.map((partner) => [String(partner.id), partner.logo]),
);

type RankedRows = Parameters<typeof RankedChart>[0]["data"];

function BreakdownRankings({
  data,
  partners,
  chainRows,
  metric,
  select,
}: {
  data: OrderChartData;
  partners: RankedRows;
  chainRows: RankedRows;
  metric: RankingMetric;
  select: (label: string, orders: ListOrder[]) => void;
}) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const group = ["apps", "networks", "types"].includes(
    search.get("chart_group") ?? "",
  )
    ? search.get("chart_group")!
    : "apps";
  const rows =
    group === "networks"
      ? chainRows
      : group === "types"
        ? data.types.map((row) => ({ ...row, id: row.label }))
        : partners;
  const title = {
    apps: "Trading apps",
    networks: "Networks",
    types: "Order types",
  }[group];
  const update = (param: string, value: string, fallback: string) => {
    const next = new URLSearchParams(search.toString());
    if (value === fallback) next.delete(param);
    else next.set(param, value);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
        <InvestigationSelect
          label="Metric"
          value={metric}
          onChange={(value) => update("chart_measure", value, "orders")}
        >
          <InvestigationSelectItem value="orders">
            Orders placed
          </InvestigationSelectItem>
          <InvestigationSelectItem value="value">
            Placed value (USD)
          </InvestigationSelectItem>
        </InvestigationSelect>
        <InvestigationSelect
          label="Breakdown"
          value={group}
          onChange={(value) => update("chart_group", value, "apps")}
        >
          <InvestigationSelectItem value="apps">
            Trading apps
          </InvestigationSelectItem>
          <InvestigationSelectItem value="networks">
            Networks
          </InvestigationSelectItem>
          <InvestigationSelectItem value="types">
            Order types
          </InvestigationSelectItem>
        </InvestigationSelect>
      </div>
      <ChartFrame
        title={title ?? "Trading apps"}
        description={`Share of ${metric === "value" ? "reported placed USD value" : "placed orders"}. Top 10 groups; select a bar or data row to inspect orders.`}
      >
        <RankedChart data={rows} metric={metric} onSelect={select} />
      </ChartFrame>
    </div>
  );
}

export default function OrderCharts({
  orders,
  snapshot,
  days,
  partnerCards,
  networks,
}: {
  orders: ListOrder[];
  snapshot: number;
  days?: number;
  partnerCards: PartnerCard[];
  networks: PartnerChainEntry[];
}) {
  const search = useSearchParams();
  const requestedInterval = search.get("chart_interval");
  const interval =
    requestedInterval === "day" ||
    requestedInterval === "week" ||
    requestedInterval === "month"
      ? (requestedInterval as ChartInterval)
      : undefined;
  const data = useMemo(
    () => buildOrderCharts(orders, snapshot, days, interval),
    [orders, snapshot, days, interval],
  );
  const [selection, setSelection] = useState<{
    label: string;
    orders: ListOrder[];
  } | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const select = (label: string, selected: ListOrder[]) => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelection({ label, orders: selected });
  };
  const partners = useMemo(
    () =>
      partnerCards.map((card) => {
        const group = card.chains.flatMap((chain) => chain.orders);
        return {
          id: card.partnerId,
          label: card.partnerName,
          logo: partnerLogos.get(card.partnerId),
          orders: group,
          value: group.reduce((sum, order) => sum + getOrderValueUsd(order), 0),
        };
      }),
    [partnerCards],
  );
  const chainRows = useMemo(
    () =>
      networks.map((chain) => ({
        id: String(chain.chainId),
        chainId: chain.chainId,
        label: chain.chainName,
        logo: getChainLogo(chain.chainId),
        orders: chain.orders,
        value: chain.stats.totalUsd,
      })),
    [networks],
  );
  return (
    <div className="space-y-5">
      <ViewTabs
        label="Chart views"
        param="chart_view"
        tabs={[
          {
            value: "trends",
            label: "Trends",
            content: (
              <div className="space-y-4">
                <div>
                  <TimelineCharts data={data} onSelect={select} />
                </div>
              </div>
            ),
          },
          {
            value: "breakdown",
            label: "Activity breakdown",
            content: (
              <BreakdownRankings
                data={data}
                partners={partners}
                chainRows={chainRows}
                metric={
                  search.get("chart_measure") === "value" ? "value" : "orders"
                }
                select={select}
              />
            ),
          },
        ]}
      />
      {selection && (
        <StatusOrdersModal
          open
          onOpenChange={(open) => {
            if (!open) setSelection(null);
          }}
          title={selection.label}
          partnerName="Charts · current filters"
          orders={selection.orders}
          description="Orders represented by this chart selection. Totals and details use the current filter scope."
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previousFocus.current?.focus();
          }}
        />
      )}
    </div>
  );
}
