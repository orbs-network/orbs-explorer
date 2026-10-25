"use client";

import { useParams } from "next/navigation";
import { resolvePartnerId } from "@/lib/partner-navigation";
import { useOrderScope } from "./use-order-scope";

/** Navigation follows the partner route even when a pasted query names another app. */
export function useOrderNavigationScope() {
  const scope = useOrderScope();
  const { partnerId } = useParams<{ partnerId?: string }>();
  return {
    ...scope,
    partnerIds: partnerId ? [resolvePartnerId(partnerId)] : scope.partnerIds,
  };
}
