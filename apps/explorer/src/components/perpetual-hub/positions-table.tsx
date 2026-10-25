"use client";
import { formatPerpetualHubStatus } from "@orbs/domain/perpetual-hub/format";
import Link from "next/link";

import { CurrentPositions } from "./current-positions";
import {
  usePathname,
  useSearchParams as usePositionViewParams,
} from "next/navigation";

import { useCallback, useMemo, useRef } from "react";
import moment from "moment";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Badge } from "@orbs/ui/controls/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";
import { VirtualTable } from "@/components/virtual-table";
import { PerpetualPositionsFilter } from "@/components/perpetual-hub/filter";
import {
  formatPerpetualHubActionName,
  formatPerpetualHubMarket,
  usePerpetualHubPositionOrderEventsPaginated,
} from "@orbs/domain/perpetual-hub";
import type { PerpetualHubOperation } from "@orbs/domain/perpetual-hub";
import { formatNumber, formatUsdCompact } from "@orbs/domain/explorer/format";
import { ROUTES } from "@/routes";
import { cn, shortenAddress } from "@orbs/domain/utils/utils";

type PositionOrderTableRow = {
  key: string;
  event: PerpetualHubOperation;
  sequenceSort: number;
  timestampSort: number;
};

const POSITION_ACTION_TYPES = new Set([
  "OPEN_POSITION",
  "CLOSE_POSITION",
  "LIQUIDATION",
  "CHANGE_LEVERAGE",
]);

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTimestampMs(timestamp?: number) {
  if (!timestamp) return 0;
  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

function actionGroup(event: PerpetualHubOperation) {
  return POSITION_ACTION_TYPES.has(event.operationType) ? "Position" : "Order";
}

function actionNotional(event: PerpetualHubOperation) {
  const quantity = Math.abs(toNumber(event.quantity));
  const price = Math.abs(toNumber(event.price));
  if (quantity && price) return quantity * price;

  if (
    event.operationType === "CHANGE_LEVERAGE" ||
    event.operationType === "CANCEL_ORDER"
  ) {
    return 0;
  }

  return Math.abs(toNumber(event.amount));
}

function rowSource(row: PositionOrderTableRow) {
  return {
    partnerId: row.event.partnerId,
    partnerName: row.event.partnerName,
    chainId: row.event.chainId,
    chainName: row.event.chainName,
    contractAddress: row.event.contractAddress,
  };
}

function rowScopedRoute(
  path: string,
  row: PositionOrderTableRow,
  extra?: Record<string, number | string | undefined>,
) {
  const { partnerId, chainId, contractAddress } = rowSource(row);
  const params = new URLSearchParams();
  if (partnerId) params.set("partner_id", partnerId);
  if (chainId) params.set("chain_id", String(chainId));
  if (contractAddress) params.set("contract", contractAddress);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.size ? `${path}?${params}` : path;
}

function eventKey(event: PerpetualHubOperation) {
  return [
    event.partnerId,
    event.chainId,
    event.contractAddress,
    event.id,
    event.teeSequence,
  ]
    .filter(Boolean)
    .join("-");
}

function SideBadge({ side }: { side?: string }) {
  if (!side) return null;

  const lower = side.toLowerCase();
  const isLong = lower.includes("buy") || lower.includes("long");
  const isShort = lower.includes("sell") || lower.includes("short");

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        isLong &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        isShort && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {side}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isSuccess = normalized.includes("success");
  const isRejected =
    normalized.includes("reject") ||
    normalized.includes("fail") ||
    normalized.includes("error");

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        isSuccess &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        isRejected &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        !isSuccess &&
          !isRejected &&
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      {formatPerpetualHubStatus(status)}
    </Badge>
  );
}

function TypeCell({ item }: { item: PositionOrderTableRow }) {
  const group = actionGroup(item.event);
  const isPosition = group === "Position";

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        isPosition
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      {group}
    </Badge>
  );
}

function ActionCell({ item }: { item: PositionOrderTableRow }) {
  return (
    <Badge variant="secondary" className="max-w-[180px] truncate text-[11px]">
      {formatPerpetualHubActionName(item.event.operationType)}
    </Badge>
  );
}

function UserCell({ item }: { item: PositionOrderTableRow }) {
  const user = item.event.userAddress;
  if (!user) return <span className="text-muted-foreground">-</span>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono text-primary">{shortenAddress(user)}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="font-mono text-xs">{user}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function PartnerCell({ item }: { item: PositionOrderTableRow }) {
  const { partnerName } = rowSource(item);

  return (
    <span
      className={cn("font-medium", !partnerName && "text-muted-foreground")}
    >
      {partnerName || "-"}
    </span>
  );
}

function ChainCell({ item }: { item: PositionOrderTableRow }) {
  const { chainName } = rowSource(item);

  return (
    <span className={cn("font-medium", !chainName && "text-muted-foreground")}>
      {chainName || "-"}
    </span>
  );
}

function MarketCell({ item }: { item: PositionOrderTableRow }) {
  const symbol = item.event.symbol;
  if (!symbol) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">{formatPerpetualHubMarket(symbol)}</span>
      <SideBadge side={item.event.side} />
    </div>
  );
}

function QuantityCell({ item }: { item: PositionOrderTableRow }) {
  const quantity = toNumber(item.event.quantity);

  return (
    <span
      className={
        quantity ? "font-mono text-foreground" : "text-muted-foreground"
      }
    >
      {quantity ? formatNumber(quantity, 4) : "-"}
    </span>
  );
}

function PriceCell({ item }: { item: PositionOrderTableRow }) {
  const price = toNumber(item.event.price);

  return (
    <span
      className={price ? "font-mono text-foreground" : "text-muted-foreground"}
    >
      {price ? formatUsdCompact(price) : "-"}
    </span>
  );
}

function NotionalCell({ item }: { item: PositionOrderTableRow }) {
  const notional = actionNotional(item.event);

  return (
    <span
      className={
        notional ? "font-medium text-foreground" : "text-muted-foreground"
      }
    >
      {notional ? formatUsdCompact(notional) : "-"}
    </span>
  );
}

function FeePnlCell({ item }: { item: PositionOrderTableRow }) {
  const value = toNumber(item.event.fee || item.event.realizedPnl);
  const isPnl = Boolean(item.event.realizedPnl);

  return (
    <span
      className={cn(
        value ? "font-mono text-foreground" : "text-muted-foreground",
        isPnl && value > 0 && "text-emerald-700 dark:text-emerald-400",
        isPnl && value < 0 && "text-destructive",
      )}
    >
      {value
        ? `${isPnl && value > 0 ? "+" : ""}${formatUsdCompact(value)}`
        : "-"}
    </span>
  );
}

function TimestampCell({ item }: { item: PositionOrderTableRow }) {
  const timestamp = toTimestampMs(item.event.timestamp);
  if (!timestamp) return <span className="text-muted-foreground">-</span>;

  const date = moment(timestamp);

  return (
    <div className="flex items-center gap-1.5">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-foreground">{date.format("MMM D, YYYY")}</span>
      <span className="text-xs text-muted-foreground">
        {date.format("HH:mm")}
      </span>
    </div>
  );
}

function StatusCell({ item }: { item: PositionOrderTableRow }) {
  return <StatusBadge status={item.event.status} />;
}

const TABLE_COLUMNS = [
  { Component: TypeCell, text: "Type" },
  { Component: ActionCell, text: "Action" },
  { Component: UserCell, text: "Account" },
  { Component: PartnerCell, text: "Trading app" },
  { Component: ChainCell, text: "Network" },
  { Component: MarketCell, text: "Market" },
  { Component: QuantityCell, text: "Quantity", className: "text-right" },
  { Component: PriceCell, text: "Price", className: "text-right" },
  { Component: NotionalCell, text: "Trade value", className: "text-right" },
  {
    Component: FeePnlCell,
    text: "Fees / profit & loss",
    className: "text-right",
  },
  { Component: TimestampCell, text: "Timestamp" },
  { Component: StatusCell, text: "Status" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((column) => ({
  text: column.text,
  className: column.className,
}));

function PositionOrderHistory() {
  const router = useRouter();
  const eventsQuery = usePerpetualHubPositionOrderEventsPaginated();
  const loadingMoreRef = useRef(false);

  const rows = useMemo<PositionOrderTableRow[]>(() => {
    const eventRows =
      eventsQuery.data?.pages.flatMap((page) =>
        page.events.map((event) => ({
          key: `event-${eventKey(event)}`,
          event,
          sequenceSort: event.teeSequence ?? 0,
          timestampSort: toTimestampMs(event.timestamp),
        })),
      ) ?? [];

    return eventRows.sort((a, b) => {
      if (a.timestampSort !== b.timestampSort)
        return b.timestampSort - a.timestampSort;
      return b.sequenceSort - a.sequenceSort;
    });
  }, [eventsQuery.data]);

  const handleSelect = useCallback(
    (row: PositionOrderTableRow) => {
      router.push(
        rowScopedRoute(ROUTES.PERPETUAL_HUB.EVENT(row.event.id), row, {
          seq: row.event.teeSequence,
        }),
      );
    },
    [router],
  );

  const handleFetchNextPage = useCallback(() => {
    if (loadingMoreRef.current || eventsQuery.isFetchingNextPage) return;

    const shouldFetch = eventsQuery.hasNextPage && !eventsQuery.isFetching;
    if (!shouldFetch) return;

    loadingMoreRef.current = true;
    void eventsQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [eventsQuery]);

  return (
    <VirtualTable<PositionOrderTableRow>
      isLoading={eventsQuery.isLoading}
      isError={eventsQuery.isError}
      onRetry={() => eventsQuery.refetch()}
      hasNextPage={eventsQuery.hasNextPage}
      warnings={eventsQuery.data?.pages[0]?.warnings ?? []}
      isFetchingNextPage={eventsQuery.isFetchingNextPage}
      fetchNextPage={handleFetchNextPage}
      tableItems={rows}
      headerLabels={HEADER_LABELS}
      desktopRows={TABLE_COLUMNS}
      onSelect={handleSelect}
      onMobileRowClick={handleSelect}
      title="Position & order history"
      headerAction={<PerpetualPositionsFilter />}
    />
  );
}

export function PerpetualHubPositionsTable() {
  const params = usePositionViewParams();
  const pathname = usePathname();
  const current = params.get("view") !== "history";
  const href = (view: string) => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    if (view === "history") next.delete("min_dollar_value");
    for (const key of ["type", "status", "order_type", "side", "timestamp"])
      next.delete(key);
    return `${pathname}?${next}`;
  };
  return (
    <div className="space-y-4">
      <nav aria-label="Position data view" className="flex flex-wrap gap-2">
        <Link
          href={href("current")}
          aria-current={current ? "page" : undefined}
          className={`rounded-md border px-3 py-2 text-sm hover:bg-muted ${current ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
        >
          Current positions & orders
        </Link>
        <Link
          href={href("history")}
          aria-current={!current ? "page" : undefined}
          className={`rounded-md border px-3 py-2 text-sm hover:bg-muted ${!current ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
        >
          Activity history
        </Link>
      </nav>
      <p className="text-sm text-muted-foreground">
        {current
          ? "Open an account for its balance and the activity behind these positions and orders."
          : "Earlier activity explains what changed. An order placed in the past may already have traded or been cancelled."}
      </p>
      {current ? <CurrentPositions /> : <PositionOrderHistory />}
    </div>
  );
}
