"use client";

import {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@orbs/ui/controls/table";

import { Button } from "@orbs/ui/controls/button";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { NetworkIcon } from "@orbs/ui/controls/network";
import { useOperationsData } from "@/components/operations/operations-view";
import { orderPeriodRange } from "@/lib/order-period";
import {
  EmptyState,
  Panel,
  TableFrame,
} from "@/components/operations/primitives";
import {
  formatOrderDate,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { partnerOrdersHref } from "@/lib/partner-navigation";
import { buildPartnerNetworkTriage } from "./partner-triage-data";

const columns = [
  { key: "network", label: "Network" },
  { key: "orders", label: "Orders" },
  { key: "failed", label: "Failure rate" },
  { key: "overdue", label: "Active past deadline" },
  { key: "latestErrors", label: "Latest attempt error" },
  { key: "latestPlaced", label: "Last order placed" },
] as const;
type SortKey = (typeof columns)[number]["key"];
const linkClass =
  "inline-flex min-h-8 items-center rounded text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PartnerNetworks({ partnerId }: { partnerId: string }) {
  const { partnerCards, networkActivity, updatedAt, scope } =
    useOperationsData();
  const search = useSearchParams().toString();
  const partnerName =
    partnerCards.find((card) => card.partnerId === partnerId)?.partnerName ??
    "This partner";
  const [sort, setSort] = useState<{
    key: SortKey | "attention";
    descending: boolean;
  }>({ key: "attention", descending: true });
  const rows = useMemo(() => {
    const triage = buildPartnerNetworkTriage(networkActivity, updatedAt);
    return triage.sort((a, b) => {
      if (sort.key === "attention")
        return (
          b.overdue - a.overdue ||
          b.latestErrors - a.latestErrors ||
          b.failed - a.failed ||
          b.orders.length - a.orders.length ||
          a.chainName.localeCompare(b.chainName)
        );
      if (sort.key === "network")
        return (
          a.chainName.localeCompare(b.chainName) * (sort.descending ? -1 : 1)
        );
      const left =
        sort.key === "orders"
          ? a.orders.length
          : sort.key === "failed"
            ? a.failureRate
            : a[sort.key];
      const right =
        sort.key === "orders"
          ? b.orders.length
          : sort.key === "failed"
            ? b.failureRate
            : b[sort.key];
      if (left === undefined)
        return right === undefined ? a.chainName.localeCompare(b.chainName) : 1;
      if (right === undefined) return -1;
      return (
        (left - right) * (sort.descending ? -1 : 1) ||
        b.orders.length - a.orders.length ||
        a.chainName.localeCompare(b.chainName)
      );
    });
  }, [networkActivity, updatedAt, sort]);
  const activeNetworks = rows.filter(
    (network) => network.chainId > 0 && network.orders.length,
  ).length;
  const unattributedOrders =
    rows.find((network) => network.chainId === 0)?.orders.length ?? 0;
  // Configured networks without orders in this period add rows of empty values.
  const visibleRows = rows.filter((network) => network.orders.length);

  return (
    <Panel
      title={`Network breakdown · orders placed in ${orderPeriodRange(scope.period)}`}
      description={`${activeNetworks} ${activeNetworks === 1 ? "network has" : "networks have"} orders in this placement cohort${unattributedOrders ? `; ${unattributedOrders} orders without a reported network` : ""}. Failure rate is currently failed / all placed orders. Latest attempt error counts orders, not attempts, and can overlap any current outcome.`}
    >
      {visibleRows.length ? (
        <TableFrame label={`Network triage for ${partnerName}`}>
          <TableHeader>
            <TableRow>
              {columns.map(({ key, label }) => {
                const active = sort.key === key;
                const descending = active
                  ? !sort.descending
                  : key !== "network";
                const Icon = active
                  ? sort.descending
                    ? ArrowDown
                    : ArrowUp
                  : ArrowUpDown;
                return (
                  <TableHead
                    key={key}
                    scope="col"
                    aria-sort={
                      active
                        ? sort.descending
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                  >
                    <Button
                      variant="ghost"
                      size="content"
                      type="button"
                      onClick={() => setSort({ key, descending })}
                      aria-label={`${label}, sort ${descending ? "descending" : "ascending"}`}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {label}
                      <Icon
                        aria-hidden
                        className={`size-3 ${active ? "text-primary" : "opacity-50"}`}
                      />
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((network) => {
              const networks = [String(network.chainId)];
              return (
                <TableRow key={network.chainId}>
                  <TableHead scope="row">
                    <Link
                      href={partnerOrdersHref(partnerId, search, {}, networks)}
                      prefetch={false}
                      className={`${linkClass} gap-2 whitespace-nowrap font-medium`}
                    >
                      <NetworkIcon
                        chainId={network.chainId}
                        name={network.chainName}
                      />
                      {network.chainName}
                    </Link>
                  </TableHead>
                  <TableCell>
                    <Link
                      href={partnerOrdersHref(partnerId, search, {}, networks)}
                      prefetch={false}
                      className={linkClass}
                      aria-label={`View ${network.orders.length} ${network.chainName} orders`}
                    >
                      {network.orders.length.toLocaleString()}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={partnerOrdersHref(
                        partnerId,
                        search,
                        { status: "failed" },
                        networks,
                      )}
                      prefetch={false}
                      className={`${linkClass} flex-col items-start justify-center ${network.failed ? "text-destructive" : "text-muted-foreground"}`}
                      aria-label={`View ${network.failed} failed of ${network.orders.length} orders on ${network.chainName}`}
                    >
                      <span>
                        {network.failureRate === undefined
                          ? "—"
                          : formatShare(network.failed, network.orders.length)}
                      </span>
                      {network.failed > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {network.failed} / {network.orders.length} failed
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={partnerOrdersHref(
                        partnerId,
                        search,
                        { status: "active", deadline: "past" },
                        networks,
                      )}
                      prefetch={false}
                      className={`${linkClass} ${network.overdue ? "text-destructive" : "text-muted-foreground"}`}
                      aria-label={`View ${network.overdue} active orders past deadline on ${network.chainName}`}
                    >
                      {network.overdue.toLocaleString()}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={partnerOrdersHref(
                        partnerId,
                        search,
                        { errors: "latest" },
                        networks,
                      )}
                      prefetch={false}
                      className={`${linkClass} ${network.latestErrors ? "text-destructive" : "text-muted-foreground"}`}
                      aria-label={`View ${network.latestErrors} orders with latest attempt errors on ${network.chainName}`}
                    >
                      {network.latestErrors.toLocaleString()}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatOrderDate(network.latestPlaced)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </TableFrame>
      ) : (
        <EmptyState
          title="No networks in this view"
          description="Choose different networks or a longer period to see this partner’s network activity."
        />
      )}
    </Panel>
  );
}
