"use client";

import { TableRow, TableHead, TableCell } from "@orbs/ui/controls/table";
import { useMemo, useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Input } from "@orbs/ui/controls/input";
import { Button } from "@orbs/ui/controls/button";
import { Switch } from "@orbs/ui/controls/switch";
import type { PartnerCard } from "@orbs/domain/twap/utils/orders-overview";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { useOrderNavigationScope } from "@/hooks/use-order-navigation-scope";
import type { OrderNavigationScope } from "@/lib/order-investigation";
import {
  buildTradingAppRows,
  withTradingAppComparison,
  sortTradingAppRows,
  tradingAppPartnerHref,
  type TradingAppSortKey,
} from "@/lib/trading-apps-table";
import {
  formatOrderDate,
  formatOrderUsd,
  formatShare,
} from "./overview-display";
import { formatHealthAge } from "@/lib/system-health";
import { placementChange } from "@/lib/placement-report";
import { TradingAppIdentity, TradingAppCount } from "./trading-app-cells";
import { ExportComparison } from "./export-comparison";

export function TradingAppsTable({
  partnerCards,
  navigationScope,
  snapshot,
  previousPartnerCards,
  hiddenPartnerCount: _hiddenPartnerCount,
}: {
  partnerCards: PartnerCard[];
  navigationScope?: OrderNavigationScope;
  snapshot: number;
  previousPartnerCards?: PartnerCard[];
  hiddenPartnerCount?: number;
}) {
  const search = useSearchParams(),
    pathname = usePathname(),
    router = useRouter(),
    id = useId();
  const locationScope = useOrderNavigationScope(),
    scope = navigationScope ?? locationScope;
  const text = search.get("app_search") ?? "";
  const allowed: TradingAppSortKey[] = [
    "partnerName",
    "totalOrders",
    "totalUsd",
    "completed",
    "active",
    "failed",
    "lastPlaced",
  ];
  const key = allowed.includes(search.get("app_sort") as TradingAppSortKey)
    ? (search.get("app_sort") as TradingAppSortKey)
    : "totalOrders";
  const direction = search.get("app_direction") === "asc" ? "asc" : "desc";
  const update = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(values))
      if (v) next.set(k, v);
      else next.delete(k);
    next.delete("table_page_trading_app_comparison");
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const rows = useMemo(
    () =>
      withTradingAppComparison(
        buildTradingAppRows(partnerCards, snapshot),
        previousPartnerCards
          ? buildTradingAppRows(previousPartnerCards, snapshot)
          : undefined,
      ),
    [partnerCards, snapshot, previousPartnerCards],
  );
  const sorted = useMemo(
    () =>
      sortTradingAppRows(
        rows.filter((row) =>
          row.partnerName.toLowerCase().includes(text.toLowerCase()),
        ),
        key,
        direction,
      ),
    [rows, text, key, direction],
  );
  const params = new URLSearchParams(scope.query ?? search.toString());
  if (scope.period) params.set("period", scope.period);
  params.delete("chain_id");
  scope.chainIds?.forEach((chain) => params.append("chain_id", chain));
  const query = params.toString();
  const header = (sort: TradingAppSortKey, label: string) => (
    <TableHead
      scope="col"
      className="text-left"
      aria-sort={
        sort === key
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <Button
        variant="ghost"
        size="content"
        type="button"
        onClick={() =>
          update({
            app_sort: sort,
            app_direction:
              key === sort && direction === "desc" ? "asc" : "desc",
          })
        }
        className="inline-flex min-h-9 items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        {sort === key ? (
          direction === "asc" ? (
            <ArrowUp aria-hidden className="size-3 text-primary" />
          ) : (
            <ArrowDown aria-hidden className="size-3 text-primary" />
          )
        ) : (
          <ArrowUpDown aria-hidden className="size-3" />
        )}
      </Button>
    </TableHead>
  );
  return (
    <section
      aria-label="Trading app comparison workspace"
      className="min-w-0 space-y-3 rounded-xl bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto w-full shrink-0 whitespace-nowrap text-lg font-semibold lg:w-auto">
          Trading apps{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({partnerCards.length})
          </span>
        </h2>
        <div className="w-full md:w-56 lg:w-64">
          <label htmlFor={`${id}-search`} className="sr-only">
            Search trading apps
          </label>
          <Input
            id={`${id}-search`}
            type="search"
            name="app_search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search trading apps…"
            value={text}
            onChange={(event) => update({ app_search: event.target.value })}
          />
        </div>
        <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
          <Switch
            checked={search.get("show_inactive_partners") === "1"}
            onCheckedChange={(checked) =>
              update({
                show_inactive_partners: checked ? "1" : undefined,
              })
            }
          />
          Include apps with no orders
        </label>
        <ExportComparison
          rows={sorted}
          query={query}
          snapshot={snapshot}
          grouping="apps"
          search={text}
        />
      </div>
      {sorted.length ? (
        <ContinuousTable
          label="Trading app comparison"
          items={sorted}
          itemKey={(row) => row.rowId}
          rowHref={(row) => tradingAppPartnerHref(row, query)}
          minWidth={1080}
          header={
            <TableRow>
              {header("partnerName", "Trading app")}
              {header("totalOrders", "Orders placed")}
              {header("totalUsd", "Placed value (USD)")}
              {header("completed", "Completed")}
              {header("active", "Active")}
              {header("failed", "Failed")}
              {header("lastPlaced", "Last order")}
            </TableRow>
          }
          rowContent={(row) => (
            <>
              <TableCell>
                <TradingAppIdentity
                  row={row}
                  href={tradingAppPartnerHref(row, query)}
                />
              </TableCell>
              <TableCell className="text-left">
                <TradingAppCount row={row} query={query} />
                {row.previousOrders !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {placementChange(row.totalOrders, row.previousOrders)} vs
                    previous period ({row.previousOrders.toLocaleString()})
                  </p>
                )}
              </TableCell>
              <TableCell
                className="text-left"
                title={`${row.pricedOrders} of ${row.totalOrders} orders report USD`}
              >
                {row.pricedOrders || !row.totalOrders
                  ? formatOrderUsd(row.totalUsd)
                  : "Unavailable"}
              </TableCell>
              <TableCell className="text-left">
                <TradingAppCount row={row} query={query} status="completed" />
                <p className="text-xs text-muted-foreground">
                  {formatShare(row.groups.completed.length, row.totalOrders)} of
                  placed
                </p>
              </TableCell>
              <TableCell className="text-left">
                <TradingAppCount row={row} query={query} status="active" />
              </TableCell>
              <TableCell className="text-left">
                <TradingAppCount row={row} query={query} status="failed" />
              </TableCell>
              <TableCell className="text-left text-xs">
                {row.lastPlaced === undefined ? (
                  "Not reported"
                ) : (
                  <time
                    dateTime={new Date(row.lastPlaced).toISOString()}
                    title={`${formatOrderDate(row.lastPlaced)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                  >
                    {row.lastPlaced <= snapshot
                      ? `${formatHealthAge(snapshot - row.lastPlaced)} ago`
                      : formatOrderDate(row.lastPlaced)}
                  </time>
                )}
              </TableCell>
            </>
          )}
        />
      ) : (
        <div className="py-8 text-center">
          <p className="font-medium">No apps with orders in this view</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Change the search or include apps with no orders.
          </p>
          {text && (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => update({ app_search: undefined })}
            >
              Clear search
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
