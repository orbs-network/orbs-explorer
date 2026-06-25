"use client";

import { useCallback, useMemo, useRef } from "react";
import moment from "moment";
import { Badge } from "@/components/ui/badge";
import { VirtualTable } from "@/components/virtual-table";
import { PerpetualHedgerFilter } from "@/components/perpetual-hub/filter";
import { formatNumber, formatUsdCompact } from "@/lib/explorer/format";
import {
  usePerpetualHubHedgerPositionsPaginated,
  type PerpetualHubHedgerPosition,
} from "@/lib/perpetual-hub";
import { cn } from "@/lib/utils/utils";

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return "-";
  return moment(
    timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp,
  ).format("MMM D, HH:mm");
}

function sideFromAmount(position: PerpetualHubHedgerPosition) {
  const amount = toNumber(position.positionAmt);
  if (amount > 0) return "Long";
  if (amount < 0) return "Short";
  return position.positionSide || "Flat";
}

function SideBadge({ item }: { item: PerpetualHubHedgerPosition }) {
  const side = sideFromAmount(item);
  const lower = side.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        lower.includes("long") &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
        lower.includes("short") &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        lower.includes("flat") && "text-muted-foreground",
      )}
    >
      {side}
    </Badge>
  );
}

function MarketCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return <span className="font-medium">{item.symbol}</span>;
}

function PartnerCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return (
    <span
      className={cn(
        "font-medium",
        !item.partnerName && "text-muted-foreground",
      )}
    >
      {item.partnerName || "-"}
    </span>
  );
}

function ChainCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return (
    <span
      className={cn("font-medium", !item.chainName && "text-muted-foreground")}
    >
      {item.chainName || "-"}
    </span>
  );
}

function AmountCell({ item }: { item: PerpetualHubHedgerPosition }) {
  const amount = toNumber(item.positionAmt);
  return (
    <span
      className={cn(
        "font-mono",
        amount > 0 && "text-emerald-500",
        amount < 0 && "text-destructive",
        amount === 0 && "text-muted-foreground",
      )}
    >
      {formatNumber(amount, 6)}
    </span>
  );
}

function EntryCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return (
    <span className="font-mono">
      {formatUsdCompact(toNumber(item.entryPrice))}
    </span>
  );
}

function NotionalCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return (
    <span className="font-mono">
      {formatUsdCompact(Math.abs(toNumber(item.notional)))}
    </span>
  );
}

function InitialMarginCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return (
    <span className="font-mono">
      {formatUsdCompact(toNumber(item.initialMargin))}
    </span>
  );
}

function MaintenanceCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return (
    <span className="font-mono">
      {formatUsdCompact(toNumber(item.maintMargin))}
    </span>
  );
}

function PnlCell({ item }: { item: PerpetualHubHedgerPosition }) {
  const pnl = toNumber(item.unrealizedProfit);
  return (
    <span
      className={cn(
        "font-mono",
        pnl > 0 && "text-emerald-500",
        pnl < 0 && "text-destructive",
        pnl === 0 && "text-muted-foreground",
      )}
    >
      {formatUsdCompact(pnl)}
    </span>
  );
}

function UpdatedCell({ item }: { item: PerpetualHubHedgerPosition }) {
  return (
    <span className="whitespace-nowrap text-muted-foreground">
      {formatTimestamp(item.updateTime)}
    </span>
  );
}

function StatusCell({ item }: { item: PerpetualHubHedgerPosition }) {
  const connected = item.connected !== false;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        connected && "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
        !connected &&
          "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {connected ? (item.dryRun ? "Dry Run" : "Online") : "Down"}
    </Badge>
  );
}

const TABLE_COLUMNS = [
  { Component: MarketCell, text: "Market" },
  { Component: PartnerCell, text: "Partner" },
  { Component: ChainCell, text: "Chain" },
  { Component: SideBadge, text: "Side" },
  { Component: AmountCell, text: "Amount", className: "text-right" },
  { Component: EntryCell, text: "Entry", className: "text-right" },
  { Component: NotionalCell, text: "Notional", className: "text-right" },
  {
    Component: InitialMarginCell,
    text: "Initial Margin",
    className: "text-right",
  },
  { Component: MaintenanceCell, text: "Maint Margin", className: "text-right" },
  { Component: PnlCell, text: "PnL", className: "text-right" },
  { Component: UpdatedCell, text: "Updated" },
  { Component: StatusCell, text: "Status" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((column) => ({
  text: column.text,
  className: column.className,
}));

export function PerpetualHubHedgerTable() {
  const hedgerQuery = usePerpetualHubHedgerPositionsPaginated();
  const loadingMoreRef = useRef(false);

  const rows = useMemo(
    () => hedgerQuery.data?.pages.flatMap((page) => page.positions) ?? [],
    [hedgerQuery.data],
  );

  const handleFetchNextPage = useCallback(() => {
    if (
      loadingMoreRef.current ||
      hedgerQuery.isFetchingNextPage ||
      hedgerQuery.isFetching ||
      !hedgerQuery.hasNextPage
    ) {
      return;
    }

    loadingMoreRef.current = true;
    void hedgerQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [hedgerQuery]);

  return (
    <VirtualTable<PerpetualHubHedgerPosition>
      isLoading={hedgerQuery.isLoading}
      isFetchingNextPage={hedgerQuery.isFetchingNextPage}
      fetchNextPage={handleFetchNextPage}
      tableItems={rows}
      headerLabels={HEADER_LABELS}
      desktopRows={TABLE_COLUMNS}
      title="Hedger"
      headerAction={<PerpetualHedgerFilter />}
    />
  );
}
