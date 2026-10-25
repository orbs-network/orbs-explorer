"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePartner } from "@orbs/domain/hooks/use-partner";
import {
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
} from "@orbs/domain/twap/utils/orders-overview";
import { cn } from "@orbs/domain/utils/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@orbs/ui/controls/avatar";
import {
  tradingAppOrdersHref,
  type TradingAppRow,
} from "@/lib/trading-apps-table";
import { STATUS_COLORS, formatShare } from "./overview-display";

export function TradingAppIdentity({
  row,
  href,
}: {
  row: TradingAppRow;
  href: string;
}) {
  const partner = usePartner(row.partnerId);
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 max-w-44 items-center gap-2 rounded-sm text-sm font-medium text-foreground hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11"
    >
      <Avatar aria-hidden className="size-6 shrink-0">
        <AvatarImage src={partner?.logo} alt="" />
        <AvatarFallback className="text-[9px]">
          {row.partnerName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate" title={row.partnerName}>
        {row.partnerName}
      </span>
    </Link>
  );
}

export function TradingAppCount({
  row,
  status,
  query,
}: {
  row: TradingAppRow;
  status?: OverviewOrderStatus;
  query: string;
}) {
  const count = status ? row.groups[status].length : row.totalOrders;
  const label = `View ${count.toLocaleString()} ${status ? `${OVERVIEW_STATUSES[status].label.toLowerCase()} ` : ""}orders for ${row.partnerName}${status === "failed" ? `, ${formatShare(count, row.totalOrders)} of ${row.totalOrders.toLocaleString()} placed orders` : ""}`;
  const content = (
    <>
      <span>{count.toLocaleString()}</span>
      {status === "failed" && (
        <span className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">
          ({formatShare(count, row.totalOrders)})
        </span>
      )}
      {count > 0 && <ChevronRight aria-hidden className="size-3 opacity-50" />}
    </>
  );
  const className = cn(
    "inline-flex min-h-8 items-center justify-end gap-1 rounded-sm px-1 font-medium tabular-nums [@media(pointer:coarse)]:min-h-11",
    count
      ? "hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      : "text-muted-foreground",
    count > 0 &&
      (status === "failed"
        ? "text-destructive"
        : status
          ? STATUS_COLORS[status]
          : "text-foreground"),
  );
  return (
    <div className="flex flex-col items-end">
      {count ? (
        <Link
          href={tradingAppOrdersHref(row, query, { status })}
          aria-label={label}
          className={className}
        >
          {content}
        </Link>
      ) : (
        <span className={className}>{content}</span>
      )}
      {status === "active" &&
        (row.activePastDeadline > 0 || row.activeLatestErrors > 0) && (
          <span className="flex flex-col items-end gap-0.5 whitespace-nowrap text-[10px]">
            {row.activePastDeadline > 0 && (
              <Link
                href={tradingAppOrdersHref(row, query, { deadline: "past" })}
                className="rounded-sm text-amber-700 dark:text-amber-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {row.activePastDeadline} past deadline
              </Link>
            )}
            {row.activeLatestErrors > 0 && (
              <Link
                href={tradingAppOrdersHref(row, query, { errors: "latest" })}
                className="rounded-sm text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Active orders whose latest execution attempt failed; distinct from failed orders."
              >
                {row.activeLatestErrors} with latest error
              </Link>
            )}
          </span>
        )}
    </div>
  );
}
