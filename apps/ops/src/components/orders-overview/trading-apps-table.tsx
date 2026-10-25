"use client";

import {
  useId,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Search,
  Settings2,
  X,
} from "lucide-react";
import {
  OVERVIEW_STATUSES,
  type OverviewOrderStatus,
  type PartnerCard,
} from "@orbs/domain/twap/utils/orders-overview";
import { NetworkIcon } from "@orbs/ui/controls/network";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@orbs/ui/controls/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";
import { CHART_COLORS } from "@/components/charts/chart-colors";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
import { cn } from "@orbs/domain/utils/utils";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { useOrderNavigationScope } from "@/hooks/use-order-navigation-scope";
import type { OrderNavigationScope } from "@/lib/order-investigation";
import { formatHealthAge } from "@/lib/system-health";
import {
  TRADING_APP_COLUMNS_STORAGE_KEY,
  buildTradingAppRows,
  parseTradingAppColumns,
  sortTradingAppRows,
  tradingAppOrdersHref,
  tradingAppPartnerHref,
  withTradingAppComparison,
  type TradingAppColumns,
  type TradingAppGrouping,
  type TradingAppRow,
  type TradingAppSortDirection,
  type TradingAppSortKey,
} from "@/lib/trading-apps-table";
import {
  formatOrderDate,
  formatOrderUsd,
  formatShare,
} from "./overview-display";
import { placementChange } from "@/lib/placement-report";
import { TradingAppCards } from "./trading-app-cards";
import { TradingAppIdentity, TradingAppCount } from "./trading-app-cells";
import { ExportComparison } from "./export-comparison";

const mobileQuery = "(max-width: 1023px)";
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;

type Sort = { key: TradingAppSortKey; direction: TradingAppSortDirection };
const columnPresets = [
  {
    value: "compact",
    label: "Operations",
    description: "Failures, active orders & execution signals",
  },
  {
    value: "business",
    label: "Business",
    description: "Orders, share, growth & placed value",
  },
  {
    value: "detailed",
    label: "All outcomes",
    description: "Every order status side by side",
  },
] as const;
const statusColumns: OverviewOrderStatus[] = [
  "completed",
  "partial",
  "active",
  "failed",
  "expired",
  "cancelled",
];
const sortPresets = [
  { key: "needsAttention", direction: "desc", label: "Needs attention" },
  { key: "failed", direction: "desc", label: "Most failed orders" },
  { key: "failedRate", direction: "desc", label: "Highest failure rate" },
  { key: "lastPlaced", direction: "desc", label: "Recent placements" },
  { key: "totalOrders", direction: "desc", label: "Most orders" },
  { key: "active", direction: "desc", label: "Most active orders" },
  { key: "totalUsd", direction: "desc", label: "Highest placed value" },
  { key: "partnerName", direction: "asc", label: "Trading app A–Z" },
] as const satisfies readonly (Sort & { label: string })[];
const COLUMNS_EVENT = "orbs-ops-trading-app-columns";
function readColumns() {
  try {
    return parseTradingAppColumns(
      localStorage.getItem(TRADING_APP_COLUMNS_STORAGE_KEY),
    );
  } catch {
    return "compact" as const;
  }
}
function subscribeColumns(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === TRADING_APP_COLUMNS_STORAGE_KEY || event.key === null)
      onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(COLUMNS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(COLUMNS_EVENT, onChange);
  };
}
const serverColumns = () => "compact" as const;

function sortValue(sort: Sort) {
  return `${sort.key}:${sort.direction}`;
}
function sortLabel(sort: Sort) {
  const preset = sortPresets.find(
    (item) => sortValue(item) === sortValue(sort),
  );
  if (preset) return preset.label;
  const descending = sort.direction === "desc";
  if (sort.key === "partnerName") return "Trading app Z–A";
  if (sort.key === "orderChange")
    return descending ? "Largest order growth" : "Lowest order growth";
  if (sort.key === "chainName")
    return sort.direction === "asc" ? "Network A–Z" : "Network Z–A";
  if (sort.key === "totalOrders") return "Fewest orders";
  if (sort.key === "totalUsd") return "Lowest placed value";
  if (sort.key === "failedRate") return "Lowest failure rate";
  if (sort.key === "lastPlaced") return "Oldest placements";
  if (sort.key === "needsAttention") return "Least attention first";
  return `${descending ? "Most" : "Fewest"} ${OVERVIEW_STATUSES[sort.key].label.toLowerCase()} orders`;
}

function OutcomeMix({ row, href }: { row: TradingAppRow; href: string }) {
  if (!row.totalOrders) return <span className="text-muted-foreground">—</span>;
  const statuses = [...statusColumns, "unknown" as const].filter(
    (status) => row.groups[status].length,
  );
  const summary = statuses
    .map(
      (status) =>
        `${OVERVIEW_STATUSES[status].label}: ${row.groups[status].length}`,
    )
    .join(", ");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          prefetch={false}
          aria-label={`View ${row.totalOrders} orders for ${row.partnerName}; ${summary}`}
          className="block w-32 rounded-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="flex h-1.5 overflow-hidden rounded-full bg-muted"
          >
            {statuses.map((status) => (
              <span
                key={status}
                style={{
                  width: `${(row.groups[status].length / row.totalOrders) * 100}%`,
                  backgroundColor: CHART_COLORS[status],
                }}
              />
            ))}
          </span>
          <span className="mt-1.5 block text-[10px] text-muted-foreground">
            {formatShare(row.groups.completed.length, row.totalOrders)}{" "}
            completed
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="min-w-44 space-y-1.5 text-xs">
        {statuses.map((status) => (
          <div key={status} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS[status] }}
              />
              {OVERVIEW_STATUSES[status].label}
            </span>
            <strong className="tabular-nums">
              {row.groups[status].length}
            </strong>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

export function TradingAppsTable({
  partnerCards,
  navigationScope,
  hiddenPartnerCount = 0,
  snapshot,
  previousPartnerCards,
}: {
  partnerCards: PartnerCard[];
  navigationScope?: OrderNavigationScope;
  hiddenPartnerCount?: number;
  snapshot: number;
  previousPartnerCards?: PartnerCard[];
}) {
  const id = useId();
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    serverSnapshot,
  );
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const locationScope = useOrderNavigationScope();
  const effectiveScope = navigationScope ?? locationScope;
  const effectiveSnapshot = snapshot;
  const grouping: TradingAppGrouping =
    searchParams.get("overview_group") === "networks" ? "networks" : "apps";
  const includeInactive = searchParams.get("show_inactive_partners") === "1";
  const updateView = (
    key: "overview_group",
    value: string,
    fallback: string,
  ) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const rows = useMemo(
    () =>
      withTradingAppComparison(
        buildTradingAppRows(
          partnerCards,
          effectiveSnapshot,
          grouping,
          includeInactive,
        ),
        previousPartnerCards
          ? buildTradingAppRows(
              previousPartnerCards,
              effectiveSnapshot,
              grouping,
              true,
            )
          : undefined,
      ),
    [
      partnerCards,
      effectiveSnapshot,
      grouping,
      includeInactive,
      previousPartnerCards,
    ],
  );
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? rows.filter((row) =>
          `${row.partnerName} ${row.partnerId} ${row.chainName ?? ""} ${row.chainId ?? ""}`
            .toLowerCase()
            .includes(query),
        )
      : rows;
  }, [rows, search]);
  const [showInactive, setOptimisticInactive] = useOptimistic(
    searchParams.get("show_inactive_partners") === "1",
  );
  const [, startTransition] = useTransition();
  const storedColumns = useSyncExternalStore(
    subscribeColumns,
    readColumns,
    serverColumns,
  );
  const [localColumns, setLocalColumns] = useState<TradingAppColumns | null>(
    null,
  );
  const columns = localColumns ?? storedColumns;
  const detailed = columns === "detailed";
  const business = columns === "business";
  const [density, setDensity] = useState("compact");
  const [sort, setSort] = useState<Sort>({
    key: "needsAttention",
    direction: "desc",
  });
  const sortedRows = useMemo(
    () => sortTradingAppRows(visibleRows, sort.key, sort.direction),
    [visibleRows, sort],
  );
  const showOther = rows.some((row) => row.groups.unknown.length > 0);
  const statuses = business
    ? []
    : detailed
      ? showOther
        ? [...statusColumns, "unknown" as const]
        : statusColumns
      : (["failed", "active"] as const);
  const currentPreset = sortPresets.find(
    (item) => sortValue(item) === sortValue(sort),
  );
  const scopeSearch = new URLSearchParams(
    effectiveScope.query ?? searchParams.toString(),
  );
  if (effectiveScope.period !== undefined)
    scopeSearch.set("period", effectiveScope.period);
  if (effectiveScope.chainIds !== undefined) {
    scopeSearch.delete("chain_id");
    effectiveScope.chainIds.forEach((chainId) =>
      scopeSearch.append("chain_id", chainId),
    );
  }
  const query = scopeSearch.toString();
  const totalOrders = rows.reduce((sum, row) => sum + row.totalOrders, 0);

  function sortHeader(key: TradingAppSortKey, label: string, sticky = false) {
    const active =
      sort.key === key || (key === "failed" && sort.key === "failedRate");
    const nextDirection = active
      ? sort.direction === "desc"
        ? "asc"
        : "desc"
      : key === "partnerName"
        ? "asc"
        : "desc";
    const Icon = active
      ? sort.direction === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;
    const actualKey = active && sort.key === "failedRate" ? "failedRate" : key;
    return (
      <th
        key={key}
        scope="col"
        aria-sort={
          active
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : undefined
        }
        className={cn(
          key === "chainName" ? "text-left" : "text-right",
          sticky && "sticky left-0 z-20 bg-card text-left",
        )}
      >
        <button
          type="button"
          onClick={() => setSort({ key: actualKey, direction: nextDirection })}
          aria-label={`${key === "failed" && sort.key === "failedRate" ? "Failure rate" : label}, sort ${nextDirection === "asc" ? "ascending" : "descending"}`}
          className={cn(
            "inline-flex min-h-8 items-center justify-end gap-1 rounded-sm text-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active && "text-foreground",
          )}
        >
          {label}
          <Icon
            aria-hidden
            className={cn(
              "size-3 shrink-0",
              active ? "text-primary" : "opacity-50",
            )}
          />
        </button>
      </th>
    );
  }

  return (
    <section
      aria-label="Trading app comparison workspace"
      className="min-w-0 gap-0 overflow-hidden rounded-xl bg-card"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-80">
          <label htmlFor={`${id}-search`} className="sr-only">
            Search trading apps
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchInput}
            id={`${id}-search`}
            type="search"
            name="partner_search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              grouping === "networks"
                ? "Search app or network…"
                : "Search trading apps…"
            }
            autoComplete="off"
            spellCheck={false}
            className="h-9 pl-8 pr-8 text-xs"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear partner search"
              onClick={() => {
                setSearch("");
                searchInput.current?.focus();
              }}
              className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 sm:contents">
          <label htmlFor={`${id}-sort`} className="sr-only">
            Sort trading apps by
          </label>
          <Select
            value={sortValue(sort)}
            onValueChange={(value) => {
              const option = sortPresets.find(
                (item) => sortValue(item) === value,
              );
              if (option)
                setSort({ key: option.key, direction: option.direction });
            }}
          >
            <SelectTrigger
              id={`${id}-sort`}
              title={
                sort.key === "needsAttention"
                  ? "Past deadline, failed latest attempt, then failed order count"
                  : undefined
              }
              className="h-9 min-w-0 flex-1 border-0 sm:w-44 sm:flex-none bg-control-background text-xs shadow-none hover:bg-control-hover focus:ring-0 focus:ring-offset-0 focus-visible:bg-control-hover"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!currentPreset && (
                <SelectItem value={sortValue(sort)}>
                  {sortLabel(sort)}
                </SelectItem>
              )}
              {sortPresets.map((option) => (
                <SelectItem key={sortValue(option)} value={sortValue(option)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                aria-label="Table display options"
              >
                <Settings2 aria-hidden className="size-3.5" />
                Display
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[75dvh] w-72 overflow-y-auto"
            >
              <DropdownMenuLabel>Group rows</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={grouping}
                onValueChange={(value) => {
                  if (value === "apps" && sort.key === "chainName")
                    setSort({ key: "needsAttention", direction: "desc" });
                  updateView("overview_group", value, "apps");
                }}
              >
                <DropdownMenuRadioItem value="apps">
                  App totals
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="networks">
                  By network
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={columns}
                onValueChange={(value) => {
                  const next = parseTradingAppColumns(value);
                  setLocalColumns(next);
                  try {
                    localStorage.setItem(TRADING_APP_COLUMNS_STORAGE_KEY, next);
                    window.dispatchEvent(new Event(COLUMNS_EVENT));
                    setLocalColumns(null);
                  } catch {
                    /* Keep the choice for this view when storage is unavailable. */
                  }
                }}
              >
                {columnPresets.map((preset) => (
                  <DropdownMenuRadioItem
                    key={preset.value}
                    value={preset.value}
                  >
                    <span>
                      <span className="block text-xs font-medium">
                        {preset.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                        {preset.description}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Row spacing</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={density}
                onValueChange={setDensity}
              >
                <DropdownMenuRadioItem value="compact">
                  Compact
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comfortable">
                  Comfortable
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={showInactive}
                onCheckedChange={(checked) => {
                  const next = new URLSearchParams(searchParams.toString());
                  if (checked === true) next.set("show_inactive_partners", "1");
                  else next.delete("show_inactive_partners");
                  startTransition(() => {
                    setOptimisticInactive(checked === true);
                    router.push(`${pathname}${next.size ? `?${next}` : ""}`, {
                      scroll: false,
                    });
                  });
                }}
              >
                Show apps with no orders
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ExportComparison
            rows={sortedRows}
            query={query}
            snapshot={snapshot}
            grouping={grouping}
            search={search}
          />
        </div>
      </div>
      {search.trim() && (
        <p role="status" className="px-4 pb-2 text-xs text-muted-foreground">
          {visibleRows.length.toLocaleString()}{" "}
          {grouping === "networks"
            ? "matching app/network rows"
            : visibleRows.length === 1
              ? "matching app"
              : "matching apps"}{" "}
          of {rows.length.toLocaleString()} in this view
        </p>
      )}
      <p role="status" className="sr-only">
        Sorted by {sortLabel(sort).toLowerCase()}.
      </p>
      <div className="mt-0 min-w-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {sortedRows.length ? (
          mobile ? (
            <TradingAppCards
              rows={sortedRows}
              query={query}
              snapshot={snapshot}
              columns={columns}
              totalOrders={totalOrders}
            />
          ) : (
            <div
              className={cn(
                "border-t border-border [&>div]:rounded-none [&>div]:border-0",
                density === "comfortable"
                  ? "[&_table]:text-sm [&_table_td]:py-3 [&_table_th]:py-3"
                  : "[&_table_td]:py-2 [&_table_th]:py-2",
              )}
            >
              <ContinuousTable
                label="Trading app comparison"
                items={sortedRows}
                itemKey={(row) => row.rowId}
                minWidth={
                  detailed
                    ? (showOther ? 1240 : 1140) +
                      (grouping === "networks" ? 150 : 0)
                    : grouping === "networks"
                      ? 1100
                      : 920
                }
                viewportHeight={`min(65dvh, ${Math.min(560, sortedRows.length * (density === "comfortable" ? 72 : 60) + 52)}px)`}
                header={
                  <tr>
                    {sortHeader("partnerName", "Trading app", true)}
                    {grouping === "networks" &&
                      sortHeader("chainName", "Network")}
                    {sortHeader("totalOrders", "Orders")}
                    {!detailed && !business && <th scope="col">Outcome mix</th>}
                    {business && (
                      <th scope="col" className="text-right">
                        Share of orders
                      </th>
                    )}
                    {business &&
                      sortHeader("orderChange", "Orders vs previous period")}
                    {statuses.map((status) =>
                      sortHeader(
                        status,
                        status === "failed"
                          ? "Failed · rate"
                          : OVERVIEW_STATUSES[status].label,
                      ),
                    )}
                    {sortHeader("totalUsd", "Placed value (USD)")}
                    {sortHeader("lastPlaced", "Last placed")}
                  </tr>
                }
                rowContent={(row) => (
                  <>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-card text-left transition-colors duration-200 group-hover:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] motion-reduce:transition-none"
                    >
                      <TradingAppIdentity
                        row={row}
                        href={tradingAppPartnerHref(row, query)}
                      />
                    </th>
                    {grouping === "networks" && (
                      <td>
                        <Link
                          href={tradingAppOrdersHref(row, query)}
                          prefetch={false}
                          className="inline-flex items-center gap-1.5 rounded-sm text-xs hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <NetworkIcon
                            chainId={row.chainId}
                            name={row.chainName}
                            className="size-4 shrink-0"
                          />
                          <span
                            className="max-w-32 truncate"
                            title={row.chainName}
                          >
                            {row.chainName}
                          </span>
                        </Link>
                      </td>
                    )}
                    <td className="text-right">
                      <TradingAppCount row={row} query={query} />
                    </td>
                    {!detailed && !business && (
                      <td>
                        <OutcomeMix
                          row={row}
                          href={tradingAppOrdersHref(row, query)}
                        />
                      </td>
                    )}
                    {business && (
                      <td className="text-right">
                        {totalOrders
                          ? formatShare(row.totalOrders, totalOrders)
                          : "—"}
                      </td>
                    )}
                    {business && (
                      <td className="text-right">
                        <span
                          title={
                            row.previousOrders === undefined
                              ? "Choose a 7- or 30-day range to compare equal placement periods."
                              : `${row.totalOrders} placed now; ${row.previousOrders} in the immediately preceding equal period.`
                          }
                        >
                          {placementChange(row.totalOrders, row.previousOrders)}
                        </span>
                        {row.previousOrders !== undefined && (
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {row.previousOrders} previously
                          </span>
                        )}
                      </td>
                    )}
                    {statuses.map((status) => (
                      <td key={status} className="text-right">
                        <TradingAppCount
                          row={row}
                          status={status}
                          query={query}
                        />
                      </td>
                    ))}
                    <td
                      className="whitespace-nowrap text-right"
                      title={`${row.pricedOrders} of ${row.totalOrders} orders reporting USD`}
                    >
                      {row.pricedOrders || !row.totalOrders
                        ? formatOrderUsd(row.totalUsd)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap text-right text-muted-foreground">
                      {row.lastPlaced === undefined ? (
                        "—"
                      ) : (
                        <time
                          dateTime={new Date(row.lastPlaced).toISOString()}
                          title={`${formatOrderDate(row.lastPlaced)} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}
                        >
                          {row.lastPlaced <= effectiveSnapshot
                            ? `${formatHealthAge(effectiveSnapshot - row.lastPlaced)} ago`
                            : formatOrderDate(row.lastPlaced)}
                        </time>
                      )}
                    </td>
                  </>
                )}
              />
            </div>
          )
        ) : (
          <div className="rounded-lg bg-muted/40 p-6 text-center">
            <h3 className="text-sm font-medium">
              {search.trim()
                ? "No matching trading apps"
                : hiddenPartnerCount && !showInactive
                  ? "No apps with orders in this view"
                  : "No trading apps match these filters"}
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {search.trim()
                ? "Try a different trading app name, ID, or network."
                : hiddenPartnerCount && !showInactive
                  ? "Open Display and select Show apps with no orders to include the other configured apps."
                  : "Try a different period, network, or trading app."}
            </p>
            {search.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearch("");
                  searchInput.current?.focus();
                }}
              >
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
