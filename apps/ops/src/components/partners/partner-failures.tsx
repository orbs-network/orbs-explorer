"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOperationsData } from "@/components/operations/operations-view";
import { FailureReasons } from "@/components/execution/failure-reasons";
import { partnerHref } from "@/lib/partner-navigation";

export function PartnerFailures({ partnerId }: { partnerId: string }) {
  const { orders } = useOperationsData();
  const search = useSearchParams().toString();
  return (
    <div className="space-y-3">
      <Link
        href={`${partnerHref(partnerId, search, "routes")}&pair_cohort=failed`}
        scroll={false}
        className="inline-flex min-h-9 items-center rounded text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        View pairs with failed orders →
      </Link>
      <FailureReasons
        orders={orders}
        cohortParam="failure_cohort"
        categoryParam="failure_category"
      />
    </div>
  );
}
