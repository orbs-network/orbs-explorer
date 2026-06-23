"use client";

import { useCallback, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { VirtualTable } from "@/components/virtual-table";
import { PerpetualRiskFilter } from "@/components/perpetual-hub/filter";
import { formatNumber, formatUsdCompact } from "@/lib/explorer/format";
import {
  usePerpetualHubRiskPaginated,
  type PerpetualHubRiskExposure,
} from "@/lib/perpetual-hub";
import { cn } from "@/lib/utils/utils";

function PartnerCell({ item }: { item: PerpetualHubRiskExposure }) {
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

function ChainCell({ item }: { item: PerpetualHubRiskExposure }) {
  return (
    <span
      className={cn("font-medium", !item.chainName && "text-muted-foreground")}
    >
      {item.chainName || "-"}
    </span>
  );
}

function MarketCell({ item }: { item: PerpetualHubRiskExposure }) {
  return (
    <Badge variant="secondary" className="text-[11px]">
      {item.symbol}
    </Badge>
  );
}

function LongOiCell({ item }: { item: PerpetualHubRiskExposure }) {
  return (
    <span className="font-mono text-emerald-500">
      {formatUsdCompact(item.longNotional)}
    </span>
  );
}

function ShortOiCell({ item }: { item: PerpetualHubRiskExposure }) {
  return (
    <span className="font-mono text-destructive">
      {formatUsdCompact(item.shortNotional)}
    </span>
  );
}

function NetOiCell({ item }: { item: PerpetualHubRiskExposure }) {
  const net = item.longNotional - item.shortNotional;
  return (
    <span
      className={cn(
        "font-mono",
        net > 0 && "text-emerald-500",
        net < 0 && "text-destructive",
        net === 0 && "text-muted-foreground",
      )}
    >
      {formatUsdCompact(net)}
    </span>
  );
}

function NetQuantityCell({ item }: { item: PerpetualHubRiskExposure }) {
  return (
    <span
      className={cn(
        "font-mono",
        item.netQuantity > 0 && "text-emerald-500",
        item.netQuantity < 0 && "text-destructive",
        item.netQuantity === 0 && "text-muted-foreground",
      )}
    >
      {formatNumber(item.netQuantity, 4)}
    </span>
  );
}

function PositionsCell({ item }: { item: PerpetualHubRiskExposure }) {
  return <span className="font-mono">{formatNumber(item.positions, 0)}</span>;
}

function SequenceCell({ item }: { item: PerpetualHubRiskExposure }) {
  return (
    <span className="font-mono text-muted-foreground">
      {item.sequenceNumber ? `#${formatNumber(item.sequenceNumber, 0)}` : "-"}
    </span>
  );
}

const TABLE_COLUMNS = [
  { Component: MarketCell, text: "Market" },
  { Component: PartnerCell, text: "Partner" },
  { Component: ChainCell, text: "Chain" },
  { Component: LongOiCell, text: "Long OI", className: "text-right" },
  { Component: ShortOiCell, text: "Short OI", className: "text-right" },
  { Component: NetOiCell, text: "Net OI", className: "text-right" },
  { Component: NetQuantityCell, text: "Net Qty", className: "text-right" },
  { Component: PositionsCell, text: "Positions", className: "text-right" },
  { Component: SequenceCell, text: "Seq", className: "text-right" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((column) => ({
  text: column.text,
  className: column.className,
}));

export function PerpetualHubRiskTable() {
  const riskQuery = usePerpetualHubRiskPaginated();
  const loadingMoreRef = useRef(false);

  const rows = useMemo(
    () => riskQuery.data?.pages.flatMap((page) => page.exposures) ?? [],
    [riskQuery.data],
  );

  const handleFetchNextPage = useCallback(() => {
    if (
      loadingMoreRef.current ||
      riskQuery.isFetchingNextPage ||
      riskQuery.isFetching ||
      !riskQuery.hasNextPage
    ) {
      return;
    }

    loadingMoreRef.current = true;
    void riskQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [riskQuery]);

  return (
    <VirtualTable<PerpetualHubRiskExposure>
      isLoading={riskQuery.isLoading}
      isFetchingNextPage={riskQuery.isFetchingNextPage}
      fetchNextPage={handleFetchNextPage}
      tableItems={rows}
      headerLabels={HEADER_LABELS}
      desktopRows={TABLE_COLUMNS}
      title="Risk"
      headerAction={<PerpetualRiskFilter />}
    />
  );
}
