"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ListOrder } from "@orbs/domain/twap/types";
import type { Token } from "@orbs/domain/types";
import { tokenQueryKey } from "@orbs/domain/token-metadata";
import { buildOrderSearchLabels } from "@/lib/order-investigation";

export function useOrderSearchLabels(
  orders: ListOrder[],
  partnerLabels: Map<ListOrder, string>,
): Map<ListOrder, string> {
  const queryClient = useQueryClient();
  return useMemo(
    () =>
      buildOrderSearchLabels(
        orders,
        (address, chainId) =>
          queryClient.getQueryData<Token | null>(
            tokenQueryKey(address, chainId),
          ),
        partnerLabels,
      ),
    [orders, partnerLabels, queryClient],
  );
}
