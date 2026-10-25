"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { PartnerChainEntry } from "@orbs/domain/twap/utils/orders-overview";
import { groupOverviewOrders } from "@orbs/domain/twap/utils/orders-overview";
import { NetworkIcon } from "@orbs/ui/controls/network";
import { hasExecutionErrors, reportedNumber } from "@/lib/order-diagnostics";
import { formatOrderUsd } from "./overview-display";
import { StatusOrdersModal } from "./status-order-modal";

const columns = [
  { key: "network", label: "Network" },
  { key: "orders", label: "Orders" },
  { key: "value", label: "Placed value" },
  { key: "completed", label: "Completed" },
  { key: "partial", label: "Partial" },
  { key: "active", label: "Active" },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired", label: "Expired" },
  { key: "failed", label: "Failed" },
  { key: "errors", label: "With errors" },
] as const;

type SortKey = (typeof columns)[number]["key"];
type SortDirection = "ascending" | "descending";

export function NetworkActivity({
  chains,
  scope,
}: {
  chains: PartnerChainEntry[];
  scope: string;
}) {
  const [sort, setSort] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({ key: "orders", direction: "descending" });
  const rows = useMemo(
    () =>
      chains.map((chain) => {
        const pricedCount = chain.orders.filter(
          (order) => reportedNumber(order.totalUSDAmount) !== undefined,
        ).length;
        return {
          ...chain,
          groups: groupOverviewOrders(chain.orders),
          errors: chain.orders.filter(hasExecutionErrors).length,
          pricedCount,
          value:
            pricedCount || !chain.orders.length
              ? chain.stats.totalUsd
              : undefined,
        };
      }),
    [chains],
  );
  const sortedRows = useMemo(() => {
    const value = (row: (typeof rows)[number]) => {
      switch (sort.key) {
        case "network":
          return row.chainName;
        case "orders":
          return row.orders.length;
        case "value":
          return row.value;
        case "errors":
          return row.errors;
        default:
          return row.groups[sort.key].length;
      }
    };
    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      // Missing USD stays after reported values in either direction.
      if (left === undefined)
        return right === undefined
          ? a.chainName.localeCompare(b.chainName) || a.chainId - b.chainId
          : 1;
      if (right === undefined) return -1;
      const comparison =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      return (
        comparison * (sort.direction === "ascending" ? 1 : -1) ||
        a.chainName.localeCompare(b.chainName) ||
        a.chainId - b.chainId
      );
    });
  }, [rows, sort]);
  const [selected, setSelected] = useState<PartnerChainEntry | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div
        className="max-h-80 overflow-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="region"
        aria-label={`Network activity for ${scope}`}
      >
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="sticky top-0 z-10 border-b border-border bg-card text-muted-foreground">
            <tr>
              {columns.map(({ key, label }) => {
                const active = sort.key === key;
                const nextDirection =
                  active && sort.direction === "descending"
                    ? "ascending"
                    : active || key !== "network"
                      ? "descending"
                      : "ascending";
                const Icon = active
                  ? sort.direction === "ascending"
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={active ? sort.direction : undefined}
                    className="whitespace-nowrap font-medium"
                  >
                    <button
                      type="button"
                      aria-label={`${label}, sort ${nextDirection}`}
                      onClick={() => setSort({ key, direction: nextDirection })}
                      className={`flex min-h-10 w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none ${active ? "text-foreground" : ""}`}
                    >
                      {label}
                      <Icon
                        aria-hidden
                        className={`size-3 shrink-0 ${active ? "text-primary" : "opacity-50"}`}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((chain) => (
              <tr
                key={chain.chainId}
                className="border-b border-border last:border-0"
              >
                <th scope="row" className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    disabled={!chain.orders.length}
                    onClick={(event) => {
                      trigger.current = event.currentTarget;
                      setSelected(chain);
                    }}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded text-left enabled:hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden>
                      <NetworkIcon
                        chainId={chain.chainId}
                        name={chain.chainName}
                      />
                    </span>
                    <span>
                      {chain.chainName}
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        Chain {chain.chainId}
                      </span>
                    </span>
                  </button>
                </th>
                <td className="px-3 py-2">
                  {chain.orders.length.toLocaleString()}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-2"
                  title={`${chain.pricedCount} of ${chain.orders.length} orders reporting USD`}
                >
                  {chain.value === undefined
                    ? "—"
                    : formatOrderUsd(chain.value)}
                </td>
                <td className="px-3 py-2 text-success">
                  {chain.groups.completed.length}
                </td>
                <td className="px-3 py-2 text-amber-700 dark:text-amber-400">
                  {chain.groups.partial.length}
                </td>
                <td className="px-3 py-2 text-link">
                  {chain.groups.active.length}
                </td>
                <td className="px-3 py-2">{chain.groups.cancelled.length}</td>
                <td className="px-3 py-2">{chain.groups.expired.length}</td>
                <td className="px-3 py-2 text-destructive">
                  {chain.groups.failed.length}
                </td>
                <td className="px-3 py-2">{chain.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <StatusOrdersModal
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={selected.chainName}
          partnerName={scope}
          orders={selected.orders}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
