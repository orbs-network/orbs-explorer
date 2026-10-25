"use client";

import type { ListOrder } from "@orbs/domain/twap/types";
import { useOperationsData } from "@/components/operations/operations-view";
export const inspectClass =
  "rounded text-link underline-offset-4 enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground";

export function InspectCount({
  orders,
  label,
}: {
  orders: ListOrder[];
  label: string;
}) {
  const { inspectOrders } = useOperationsData();
  return (
    <button
      type="button"
      disabled={!orders.length}
      onClick={() => inspectOrders(label, orders)}
      aria-label={`Inspect ${label.toLowerCase()}: ${orders.length} orders`}
      className={inspectClass}
    >
      {orders.length.toLocaleString()}
    </button>
  );
}
