"use client";

import { useCallback, useMemo, useRef } from "react";
import moment from "moment";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VirtualTable } from "@/components/virtual-table";
import { PerpetualRollupsFilter } from "@/components/perpetual-hub/filter";
import { formatNumber } from "@/lib/explorer/format";
import {
  usePerpetualHubRollupsPaginated,
  type PerpetualHubRollup,
} from "@/lib/perpetual-hub";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils/utils";

function truncate(value?: string, chars = 5) {
  if (!value) return "-";
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return "-";
  return moment(
    timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp,
  ).format("MMM D, HH:mm");
}

function scopedRollupRoute(rollup: PerpetualHubRollup) {
  const params = new URLSearchParams();
  if (rollup.partnerId) params.set("partner_id", rollup.partnerId);
  if (rollup.chainId) params.set("chain_id", String(rollup.chainId));
  if (rollup.contractAddress) params.set("contract", rollup.contractAddress);
  const path = ROUTES.PERPETUAL_HUB.ROLLUP(rollup.id);
  return params.size ? `${path}?${params}` : path;
}

function RollupCell({ item }: { item: PerpetualHubRollup }) {
  return (
    <span className="font-mono text-primary">#{formatNumber(item.id, 0)}</span>
  );
}

function PartnerCell({ item }: { item: PerpetualHubRollup }) {
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

function ChainCell({ item }: { item: PerpetualHubRollup }) {
  return (
    <span
      className={cn("font-medium", !item.chainName && "text-muted-foreground")}
    >
      {item.chainName || "-"}
    </span>
  );
}

function StatusCell({ item }: { item: PerpetualHubRollup }) {
  const normalized = item.status.toLowerCase();
  const isConfirmed = normalized.includes("confirm");
  const isFailed = normalized.includes("fail") || normalized.includes("error");
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] uppercase",
        isConfirmed &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
        isFailed && "border-destructive/40 bg-destructive/10 text-destructive",
        !isConfirmed &&
          !isFailed &&
          "border-amber-500/40 bg-amber-500/10 text-amber-500",
      )}
    >
      {item.status}
    </Badge>
  );
}

function OpsCell({ item }: { item: PerpetualHubRollup }) {
  return (
    <span className="font-mono">{formatNumber(item.operationsCount, 0)}</span>
  );
}

function SequenceCell({ item }: { item: PerpetualHubRollup }) {
  return (
    <span className="whitespace-nowrap font-mono">
      #{formatNumber(item.oldSequence, 0)} - #
      {formatNumber(item.newSequence, 0)}
    </span>
  );
}

function SubmittedCell({ item }: { item: PerpetualHubRollup }) {
  return (
    <span className="whitespace-nowrap text-muted-foreground">
      {formatTimestamp(item.submittedAt)}
    </span>
  );
}

function ConfirmedCell({ item }: { item: PerpetualHubRollup }) {
  return (
    <span className="whitespace-nowrap text-muted-foreground">
      {formatTimestamp(item.confirmedAt)}
    </span>
  );
}

function TxCell({ item }: { item: PerpetualHubRollup }) {
  if (!item.txHash) return <span className="text-muted-foreground">-</span>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono text-primary">{truncate(item.txHash)}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="font-mono text-xs">{item.txHash}</span>
      </TooltipContent>
    </Tooltip>
  );
}

const TABLE_COLUMNS = [
  { Component: RollupCell, text: "Rollup" },
  { Component: PartnerCell, text: "Partner" },
  { Component: ChainCell, text: "Chain" },
  { Component: StatusCell, text: "Status" },
  { Component: OpsCell, text: "Ops", className: "text-right" },
  { Component: SequenceCell, text: "Sequences" },
  { Component: SubmittedCell, text: "Submitted" },
  { Component: ConfirmedCell, text: "Confirmed" },
  { Component: TxCell, text: "Tx" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((column) => ({
  text: column.text,
  className: column.className,
}));

export function PerpetualHubRollupsTable() {
  const router = useRouter();
  const rollupsQuery = usePerpetualHubRollupsPaginated();
  const loadingMoreRef = useRef(false);

  const rows = useMemo(
    () => rollupsQuery.data?.pages.flatMap((page) => page.rollups) ?? [],
    [rollupsQuery.data],
  );

  const handleSelect = useCallback(
    (row: PerpetualHubRollup) => {
      router.push(scopedRollupRoute(row));
    },
    [router],
  );

  const handleFetchNextPage = useCallback(() => {
    if (
      loadingMoreRef.current ||
      rollupsQuery.isFetchingNextPage ||
      rollupsQuery.isFetching ||
      !rollupsQuery.hasNextPage
    ) {
      return;
    }

    loadingMoreRef.current = true;
    void rollupsQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [rollupsQuery]);

  return (
    <VirtualTable<PerpetualHubRollup>
      isLoading={rollupsQuery.isLoading}
      isFetchingNextPage={rollupsQuery.isFetchingNextPage}
      fetchNextPage={handleFetchNextPage}
      tableItems={rows}
      headerLabels={HEADER_LABELS}
      desktopRows={TABLE_COLUMNS}
      onSelect={handleSelect}
      onMobileRowClick={handleSelect}
      title="Rollups"
      headerAction={<PerpetualRollupsFilter />}
    />
  );
}
