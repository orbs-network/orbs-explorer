"use client";

import { useCallback, useMemo, useRef } from "react";
import moment from "moment";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VirtualTable } from "@/components/virtual-table";
import { PerpetualActionsFilter } from "@/components/perpetual-hub/filter";
import {
  formatPerpetualHubActionName,
  formatPerpetualHubMarket,
  usePerpetualHubActionsPaginated,
} from "@/lib/perpetual-hub";
import type { PerpetualHubOperation } from "@/lib/perpetual-hub";
import { formatNumber, formatUsdCompact } from "@/lib/explorer/format";
import { ROUTES } from "@/lib/routes";
import { cn, shortenAddress } from "@/lib/utils/utils";

type ActionTableRow = {
  key: string;
  event: PerpetualHubOperation;
  sequenceSort: number;
  timestampSort: number;
};

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

function actionNotional(event: PerpetualHubOperation) {
  const amount = Math.abs(toNumber(event.amount));
  if (amount) return amount;
  const quantity = Math.abs(toNumber(event.quantity));
  const price = Math.abs(toNumber(event.price));
  return quantity && price ? quantity * price : 0;
}

function rowUser(row: ActionTableRow) {
  return row.event.userAddress;
}

function rowSymbol(row: ActionTableRow) {
  return row.event.symbol;
}

function rowSource(row: ActionTableRow) {
  return {
    partnerId: row.event.partnerId,
    partnerName: row.event.partnerName,
    chainId: row.event.chainId,
    chainName: row.event.chainName,
    contractAddress: row.event.contractAddress,
  };
}

function rowSide(row: ActionTableRow) {
  return row.event.side;
}

function rowQuantity(row: ActionTableRow) {
  return toNumber(row.event.quantity);
}

function rowNotional(row: ActionTableRow) {
  return actionNotional(row.event);
}

function rowFeeOrPnl(row: ActionTableRow) {
  return toNumber(row.event.fee || row.event.realizedPnl);
}

function rowTimestamp(row: ActionTableRow) {
  return row.event.timestamp;
}

function rowStatus(row: ActionTableRow) {
  return row.event.status;
}

function rowScopedRoute(
  path: string,
  row: ActionTableRow,
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
  if (!side) return <span className="text-muted-foreground">-</span>;

  const lower = side.toLowerCase();
  const isLong = lower.includes("buy") || lower.includes("long");
  const isShort = lower.includes("sell") || lower.includes("short");

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        isLong && "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
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
  const isOpen = normalized.includes("open");
  const isRejected =
    normalized.includes("reject") ||
    normalized.includes("fail") ||
    normalized.includes("error");

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        (isSuccess || isOpen) &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
        isRejected &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        !isSuccess &&
          !isOpen &&
          !isRejected &&
          "border-amber-500/40 bg-amber-500/10 text-amber-500",
      )}
    >
      {status}
    </Badge>
  );
}

function ActionTypeCell({ item }: { item: ActionTableRow }) {
  const label = formatPerpetualHubActionName(item.event.operationType);

  return (
    <Badge variant="secondary" className="max-w-[180px] truncate text-[11px]">
      {label}
    </Badge>
  );
}

function UserCell({ item }: { item: ActionTableRow }) {
  const user = rowUser(item);
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

function PartnerCell({ item }: { item: ActionTableRow }) {
  const { partnerName } = rowSource(item);

  return (
    <span
      className={cn("font-medium", !partnerName && "text-muted-foreground")}
    >
      {partnerName || "-"}
    </span>
  );
}

function ChainCell({ item }: { item: ActionTableRow }) {
  const { chainName } = rowSource(item);

  return (
    <span className={cn("font-medium", !chainName && "text-muted-foreground")}>
      {chainName || "-"}
    </span>
  );
}

function MarketCell({ item }: { item: ActionTableRow }) {
  const symbol = rowSymbol(item);
  if (!symbol) return null;
  const market = formatPerpetualHubMarket(symbol);

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">{market}</span>
      <SideBadge side={rowSide(item)} />
    </div>
  );
}

function NotionalCell({ item }: { item: ActionTableRow }) {
  const notional = rowNotional(item);

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

function QuantityCell({ item }: { item: ActionTableRow }) {
  const quantity = rowQuantity(item);

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

function FeePnlCell({ item }: { item: ActionTableRow }) {
  const value = rowFeeOrPnl(item);
  const isPnl = Boolean(item.event.realizedPnl);

  return (
    <span
      className={cn(
        value ? "font-mono text-foreground" : "text-muted-foreground",
        isPnl && value > 0 && "text-emerald-500",
        isPnl && value < 0 && "text-destructive",
      )}
    >
      {value
        ? `${isPnl && value > 0 ? "+" : ""}${formatUsdCompact(value)}`
        : "-"}
    </span>
  );
}

function TimestampCell({ item }: { item: ActionTableRow }) {
  const timestamp = toTimestampMs(rowTimestamp(item));
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

function StatusCell({ item }: { item: ActionTableRow }) {
  return <StatusBadge status={rowStatus(item)} />;
}

const TABLE_COLUMNS = [
  { Component: ActionTypeCell, text: "Action" },
  { Component: UserCell, text: "User" },
  { Component: PartnerCell, text: "Partner" },
  { Component: ChainCell, text: "Chain" },
  { Component: MarketCell, text: "Market" },
  { Component: NotionalCell, text: "Notional" },
  { Component: QuantityCell, text: "Quantity" },
  { Component: FeePnlCell, text: "Fees / PnL" },
  { Component: TimestampCell, text: "Timestamp" },
  { Component: StatusCell, text: "Status" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((column) => ({ text: column.text }));

export function PerpetualHubActionsTable() {
  const router = useRouter();
  const actionsQuery = usePerpetualHubActionsPaginated();
  const loadingMoreRef = useRef(false);

  const rows = useMemo<ActionTableRow[]>(() => {
    const actionRows =
      actionsQuery.data?.pages.flatMap((page) =>
        page.events.map((event) => ({
          key: `event-${eventKey(event)}`,
          event,
          sequenceSort: event.teeSequence ?? 0,
          timestampSort: toTimestampMs(event.timestamp),
        })),
      ) ?? [];

    return actionRows.sort((a, b) => {
      if (a.timestampSort !== b.timestampSort)
        return b.timestampSort - a.timestampSort;
      return b.sequenceSort - a.sequenceSort;
    });
  }, [actionsQuery.data]);

  const handleSelect = useCallback(
    (row: ActionTableRow) => {
      router.push(
        rowScopedRoute(ROUTES.PERPETUAL_HUB.EVENT(row.event.id), row, {
          seq: row.event.teeSequence,
        }),
      );
    },
    [router],
  );

  const handleFetchNextPage = useCallback(() => {
    if (loadingMoreRef.current || actionsQuery.isFetchingNextPage) return;

    const shouldFetchActions =
      actionsQuery.hasNextPage && !actionsQuery.isFetching;

    if (!shouldFetchActions) return;
    loadingMoreRef.current = true;

    void actionsQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [actionsQuery]);

  return (
    <VirtualTable<ActionTableRow>
      isLoading={actionsQuery.isLoading}
      isFetchingNextPage={actionsQuery.isFetchingNextPage}
      fetchNextPage={handleFetchNextPage}
      tableItems={rows}
      headerLabels={HEADER_LABELS}
      desktopRows={TABLE_COLUMNS}
      onSelect={handleSelect}
      onMobileRowClick={handleSelect}
      title="Actions"
      headerAction={<PerpetualActionsFilter />}
    />
  );
}
