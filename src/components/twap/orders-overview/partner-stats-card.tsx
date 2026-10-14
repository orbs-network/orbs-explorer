"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  type PartnerCard,
  groupOverviewOrders,
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
  getOrderValueUsd,
  getTopPairsByVolume,
} from "@/lib/twap/utils/orders-overview";
import { usePartner } from "@/lib/hooks/use-partner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FilterCombobox } from "@/components/filter-combobox";
import { ChevronRight, ArrowRight } from "lucide-react";
import { StatusOrdersModal } from "./status-order-modal";
import { OrderTokenLabel } from "./order-token-label";
import { STATUS_COLORS, formatOrderUsd } from "./overview-display";
import { cn } from "@/lib/utils/utils";

export function PartnerStatsCard({
  partnerCard,
}: {
  partnerCard: PartnerCard;
}) {
  const { partnerId, partnerName, chains } = partnerCard;
  const partner = usePartner(partnerId);
  const id = useId();
  const [network, setNetwork] = useState<string[]>([]);
  const lastTrigger = useRef<HTMLButtonElement>(null);
  const [openStatus, setOpenStatus] = useState<OverviewOrderStatus | null>(
    null,
  );
  const [showRoutes, setShowRoutes] = useState(false);
  const selectedChains = useMemo(
    () =>
      network.length
        ? chains.filter((c) => network.includes(String(c.chainId)))
        : chains,
    [chains, network],
  );
  const routes = useMemo(
    () =>
      selectedChains
        .flatMap((chain) =>
          getTopPairsByVolume(chain.orders, 3).map((pair) => ({
            ...pair,
            chainId: chain.chainId,
            chainName: chain.chainName,
          })),
        )
        .sort((a, b) => b.totalUsd - a.totalUsd)
        .slice(0, 3),
    [selectedChains],
  );
  const orders = useMemo(
    () => selectedChains.flatMap((c) => c.orders),
    [selectedChains],
  );
  const groups = useMemo(() => groupOverviewOrders(orders), [orders]);
  const totalUsd = orders.reduce(
    (sum, order) => sum + getOrderValueUsd(order),
    0,
  );
  const networkLabel =
    selectedChains.length === 1
      ? selectedChains[0].chainName
      : `${selectedChains.length} networks`;
  const statuses = (
    Object.keys(OVERVIEW_STATUSES) as OverviewOrderStatus[]
  ).filter((key) => key !== "unknown" || groups.unknown.length);
  return (
    <article
      aria-labelledby={id}
      className="min-w-0 self-start rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        {partner && (
          <Avatar aria-hidden className="size-9 shrink-0 border border-border">
            <AvatarImage src={partner.logo} alt="" />
            <AvatarFallback>{partnerName.slice(0, 2)}</AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <h3 id={id} className="break-words font-semibold">
            {partnerName}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{networkLabel}</p>
        </div>
        <span className="shrink-0 text-right tabular-nums">
          <strong className="block text-lg font-semibold">
            {orders.length.toLocaleString()}
          </strong>
          <span className="text-xs text-muted-foreground">
            {orders.length === 1 ? "order" : "orders"}
          </span>
        </span>
      </div>
      {chains.length > 1 && (
        <div className="mt-3">
          <FilterCombobox
            label="Network"
            options={chains.map((c) => ({
              label: c.chainName,
              value: String(c.chainId),
            }))}
            value={network}
            onChange={setNetwork}
          />
        </div>
      )}
      <div className="my-3 flex items-center justify-between gap-2 border-b border-border pb-3 text-sm">
        <span className="text-muted-foreground">Placed order value</span>
        <strong className="font-medium tabular-nums">
          {formatOrderUsd(totalUsd)}
        </strong>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {statuses.map((key) => (
          <button
            key={key}
            type="button"
            disabled={!groups[key].length}
            onClick={(event) => {
              lastTrigger.current = event.currentTarget;
              setOpenStatus(key);
            }}
            aria-label={`View ${groups[key].length} ${OVERVIEW_STATUSES[key].label.toLowerCase()} orders for ${partnerName}, ${networkLabel}`}
            className="flex min-w-0 items-center justify-between gap-1 rounded-md px-1 py-2 text-left text-xs transition-colors enabled:hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          >
            <span className="text-muted-foreground">
              {OVERVIEW_STATUSES[key].label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold tabular-nums",
                STATUS_COLORS[key],
              )}
            >
              {groups[key].length}
              {groups[key].length > 0 && (
                <ChevronRight aria-hidden className="size-3" />
              )}
            </span>
          </button>
        ))}
      </div>
      <details
        className="mt-3 border-t border-border pt-3"
        onToggle={(event) => setShowRoutes(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Popular token routes
        </summary>
        {showRoutes && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Largest routes by placed order value.
            </p>
            {routes.map((pair) => (
              <div
                key={`${pair.chainId}:${pair.inputToken}:${pair.outputToken}`}
                className="space-y-1"
              >
                {selectedChains.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {pair.chainName}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1">
                    <OrderTokenLabel
                      address={pair.inputToken}
                      chainId={pair.chainId}
                    />
                    <ArrowRight
                      aria-hidden
                      className="size-3 shrink-0 text-muted-foreground"
                    />
                    <OrderTokenLabel
                      address={pair.outputToken}
                      chainId={pair.chainId}
                    />
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatOrderUsd(pair.totalUsd)} · {pair.orderCount}{" "}
                    {pair.orderCount === 1 ? "order" : "orders"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </details>
      {openStatus && (
        <StatusOrdersModal
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastTrigger.current?.focus();
          }}
          open
          onOpenChange={(open) => {
            if (!open) setOpenStatus(null);
          }}
          partnerName={`${partnerName} · ${networkLabel}`}
          orders={groups[openStatus]}
          title={OVERVIEW_STATUSES[openStatus].label}
          variant={openStatus}
        />
      )}
    </article>
  );
}
