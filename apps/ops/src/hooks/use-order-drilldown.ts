"use client";
import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ListOrder } from "@orbs/domain/twap/types";
import {
  orderDetailHref,
  ordersScopeHref,
  type OrderNavigationScope,
} from "@/lib/order-investigation";
import { orderIdentity, saveOrderSelection } from "@/lib/order-selection";

export function useOrderDrilldown(
  scope: OrderNavigationScope,
  snapshot: number,
) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { period, chainIds, partnerIds } = scope;
  return useCallback(
    (label: string, orders: ListOrder[], _description?: string) => {
      if (!orders.length) return;
      try {
        const id = saveOrderSelection({
          label,
          keys: [...new Set(orders.map(orderIdentity))],
          snapshot: snapshot > 0 ? snapshot : Date.now(),
          origin: `${pathname}${search.size ? `?${search}` : ""}`,
        });
        router.push(
          ordersScopeHref({
            period,
            chainIds,
            partnerIds,
            query: `order_set=${id}`,
          }),
        );
      } catch {
        if (orders.length === 1)
          router.push(
            orderDetailHref(orders[0].hash, orders[0].source, {
              period,
              chainIds,
              partnerIds,
            }),
          );
        else
          toast.error(
            "The selected orders could not be opened. Allow browser session storage and try again.",
          );
      }
    },
    [router, pathname, search, period, chainIds, partnerIds, snapshot],
  );
}
