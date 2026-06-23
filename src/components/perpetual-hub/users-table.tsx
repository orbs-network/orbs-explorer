"use client";

import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VirtualTable } from "@/components/virtual-table";
import { PerpetualUsersFilter } from "@/components/perpetual-hub/filter";
import { formatNumber, formatUsdCompact } from "@/lib/explorer/format";
import {
  usePerpetualHubUsersPaginated,
  type PerpetualHubUserBalance,
} from "@/lib/perpetual-hub";
import { ROUTES } from "@/lib/routes";
import { cn, shortenAddress } from "@/lib/utils/utils";

function scopedUserRoute(user: PerpetualHubUserBalance) {
  const params = new URLSearchParams();
  if (user.partnerId) params.set("partner_id", user.partnerId);
  if (user.chainId) params.set("chain_id", String(user.chainId));
  if (user.contractAddress) params.set("contract", user.contractAddress);
  const path = ROUTES.PERPETUAL_HUB.USER(user.address);
  return params.size ? `${path}?${params}` : path;
}

function UserCell({ item }: { item: PerpetualHubUserBalance }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono text-primary">
          {shortenAddress(item.address, 6)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="font-mono text-xs">{item.address}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function PartnerCell({ item }: { item: PerpetualHubUserBalance }) {
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

function ChainCell({ item }: { item: PerpetualHubUserBalance }) {
  return (
    <span
      className={cn("font-medium", !item.chainName && "text-muted-foreground")}
    >
      {item.chainName || "-"}
    </span>
  );
}

function MoneyCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "font-mono",
        value ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {formatUsdCompact(value)}
    </span>
  );
}

function SignedMoneyCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "font-mono",
        value > 0 && "text-emerald-500",
        value < 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {formatUsdCompact(value)}
    </span>
  );
}

function WalletCell({ item }: { item: PerpetualHubUserBalance }) {
  return <MoneyCell value={item.wallet} />;
}

function AvailableCell({ item }: { item: PerpetualHubUserBalance }) {
  return <MoneyCell value={item.available} />;
}

function MarginCell({ item }: { item: PerpetualHubUserBalance }) {
  return <MoneyCell value={item.marginBalance} />;
}

function MarginUsedCell({ item }: { item: PerpetualHubUserBalance }) {
  return <MoneyCell value={item.marginUsed} />;
}

function PnlCell({ item }: { item: PerpetualHubUserBalance }) {
  return <SignedMoneyCell value={item.unrealizedPnl} />;
}

function PositionsCell({ item }: { item: PerpetualHubUserBalance }) {
  return (
    <span className="font-mono text-foreground">
      {formatNumber(item.positions, 0)}
    </span>
  );
}

function OrdersCell({ item }: { item: PerpetualHubUserBalance }) {
  return (
    <span className="font-mono text-foreground">
      {formatNumber(item.orders, 0)}
    </span>
  );
}

function StatusCell({ item }: { item: PerpetualHubUserBalance }) {
  if (!item.ok) {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 bg-destructive/10 text-[11px] uppercase text-destructive"
      >
        Error
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-[11px] uppercase text-emerald-500"
    >
      Active
    </Badge>
  );
}

const TABLE_COLUMNS = [
  { Component: UserCell, text: "User" },
  { Component: PartnerCell, text: "Partner" },
  { Component: ChainCell, text: "Chain" },
  { Component: WalletCell, text: "Wallet", className: "text-right" },
  { Component: AvailableCell, text: "Available", className: "text-right" },
  { Component: MarginCell, text: "Margin", className: "text-right" },
  { Component: MarginUsedCell, text: "Margin Used", className: "text-right" },
  { Component: PnlCell, text: "Unrealized PnL", className: "text-right" },
  { Component: PositionsCell, text: "Positions", className: "text-right" },
  { Component: OrdersCell, text: "Orders", className: "text-right" },
  { Component: StatusCell, text: "Status" },
];

const HEADER_LABELS = TABLE_COLUMNS.map((column) => ({
  text: column.text,
  className: column.className,
}));

export function PerpetualHubUsersTable() {
  const router = useRouter();
  const usersQuery = usePerpetualHubUsersPaginated();
  const loadingMoreRef = useRef(false);

  const rows = useMemo(
    () => usersQuery.data?.pages.flatMap((page) => page.users) ?? [],
    [usersQuery.data],
  );

  const handleSelect = useCallback(
    (row: PerpetualHubUserBalance) => {
      router.push(scopedUserRoute(row));
    },
    [router],
  );

  const handleFetchNextPage = useCallback(() => {
    if (
      loadingMoreRef.current ||
      usersQuery.isFetchingNextPage ||
      usersQuery.isFetching ||
      !usersQuery.hasNextPage
    ) {
      return;
    }

    loadingMoreRef.current = true;
    void usersQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [usersQuery]);

  return (
    <VirtualTable<PerpetualHubUserBalance>
      isLoading={usersQuery.isLoading}
      isFetchingNextPage={usersQuery.isFetchingNextPage}
      fetchNextPage={handleFetchNextPage}
      tableItems={rows}
      headerLabels={HEADER_LABELS}
      desktopRows={TABLE_COLUMNS}
      onSelect={handleSelect}
      onMobileRowClick={handleSelect}
      title="Users"
      headerAction={<PerpetualUsersFilter />}
    />
  );
}
