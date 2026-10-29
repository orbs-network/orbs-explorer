"use client";

import { TableRow, TableHead, TableCell } from "@orbs/ui/controls/table";

import { Button } from "@orbs/ui/controls/button";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@orbs/ui/controls/input";
import type { ListOrder } from "@orbs/domain/twap/types";
import { getChainName } from "@orbs/domain/utils/utils";
import type { MarketRoute, TokenActivity } from "@/lib/market-analytics";
import { EmptyState, Panel } from "@/components/operations/primitives";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { formatOrderUsd } from "@/components/orders-overview/overview-display";
import {
  cellClass,
  inspectClass,
  NetworkLabel,
  TokenIdentity,
  TokenReferenceCopy,
} from "./analytics-labels";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";

type Inspect = (
  title: string,
  orders: ListOrder[],
  description?: string,
) => void;
type Ranking = "value" | "orders" | "errors" | "input" | "output";

function RankingsControl({
  kind,
  search,
  onSearch,
  ranking,
  onRanking,
}: {
  kind: string;
  search: string;
  onSearch: (value: string) => void;
  ranking: Ranking;
  onRanking: (value: Ranking) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="relative min-w-48 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          name={`${kind}-search`}
          autoComplete="off"
          spellCheck={false}
          aria-label={`Search ${kind}`}
          placeholder="Search symbols, addresses, or networks…"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="pl-9"
        />
      </div>
      <div className="w-full sm:w-48">
        <InvestigationSelect
          label={`Sort ${kind} by`}
          hideLabel
          value={ranking}
          onChange={(value) => onRanking(value as Ranking)}
        >
          <InvestigationSelectItem value="value">
            Placed value
          </InvestigationSelectItem>
          <InvestigationSelectItem value="orders">
            Order count
          </InvestigationSelectItem>
          <InvestigationSelectItem value="errors">
            Orders with errors
          </InvestigationSelectItem>
          {kind === "tokens" && (
            <>
              <InvestigationSelectItem value="input">
                Input orders
              </InvestigationSelectItem>
              <InvestigationSelectItem value="output">
                Output orders
              </InvestigationSelectItem>
            </>
          )}
        </InvestigationSelect>
      </div>
    </div>
  );
}

const searchText = (
  chainId: number,
  references: { address: string; token?: { symbol: string; name?: string } }[],
) =>
  `${getChainName(chainId) ?? ""} ${chainId} ${references.map((token) => `${token.address} ${token.token?.symbol ?? ""} ${token.token?.name ?? ""}`).join(" ")}`.toLowerCase();
function sortRankings<
  T extends {
    key: string;
    summary: { value: number; orders: ListOrder[]; withErrors: ListOrder[] };
  },
>(
  rows: T[],
  ranking: Ranking,
  sideOrders?: (row: T, side: "input" | "output") => number,
) {
  return rows.sort(
    (a, b) =>
      (ranking === "input" || ranking === "output"
        ? (sideOrders?.(b, ranking) ?? 0) - (sideOrders?.(a, ranking) ?? 0)
        : ranking === "orders"
          ? b.summary.orders.length - a.summary.orders.length
          : ranking === "errors"
            ? b.summary.withErrors.length - a.summary.withErrors.length
            : b.summary.value - a.summary.value) ||
      b.summary.orders.length - a.summary.orders.length ||
      a.key.localeCompare(b.key),
  );
}

export function RouteRankings({
  routes,
  inspect,
}: {
  routes: MarketRoute[];
  inspect: Inspect;
}) {
  const [search, setSearch] = useState("");
  const [ranking, setRanking] = useState<Ranking>("orders");
  const filtered = useMemo(
    () =>
      sortRankings(
        routes.filter((route) =>
          searchText(route.chainId, [route.input, route.output]).includes(
            search.trim().toLowerCase(),
          ),
        ),
        ranking,
      ),
    [routes, search, ranking],
  );
  return (
    <Panel
      title="Directional routes"
      description="Input → output is directional. Every order belongs to one route on its own network. Select any value to inspect its orders."
    >
      <RankingsControl
        kind="routes"
        search={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        ranking={ranking}
        onRanking={(value) => {
          setRanking(value);
        }}
      />
      <p role="status" className="mb-3 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()}{" "}
        {filtered.length === 1 ? "route" : "routes"}
        {search.trim()
          ? filtered.length === 1
            ? " matches your search"
            : " match your search"
          : " in this view"}
      </p>
      {filtered.length ? (
        <ContinuousTable
          label="Directional route rankings"
          items={filtered}
          itemKey={(route) => route.key}
          minWidth={1040}
          header={
            <TableRow>
              {[
                "Route",
                "Network",
                "Orders",
                "Placed value",
                "Completed",
                "Active",
                "Failed",
                "With errors",
              ].map((label) => (
                <TableHead
                  key={label}
                  scope="col"
                  className={`${cellClass} font-medium text-muted-foreground`}
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          }
          rowContent={(route) => {
            const { summary } = route;
            const title = `${route.input.token?.symbol ?? route.input.address} → ${route.output.token?.symbol ?? route.output.address}`;
            return (
              <>
                <TableHead scope="row" className={cellClass}>
                  <div className="group/route flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="content"
                      type="button"
                      className={`flex items-center gap-3 ${inspectClass}`}
                      onClick={() => inspect(title, summary.orders)}
                    >
                      <TokenIdentity reference={route.input} />
                      <ArrowRight
                        aria-hidden
                        className="size-3 shrink-0 text-muted-foreground"
                      />
                      <TokenIdentity reference={route.output} />
                    </Button>
                    {/* Copy actions stay out of the way until the row is in use. */}
                    <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/route:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
                      <TokenReferenceCopy reference={route.input} />
                      <TokenReferenceCopy reference={route.output} />
                    </span>
                  </div>
                </TableHead>
                <TableCell className={cellClass}>
                  <NetworkLabel chainId={route.chainId} />
                </TableCell>
                <TableCell className={cellClass}>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    className={inspectClass}
                    onClick={() => inspect(title, summary.orders)}
                  >
                    {summary.orders.length.toLocaleString()}
                  </Button>
                </TableCell>
                <TableCell className={cellClass}>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    className={inspectClass}
                    onClick={() => inspect(title, summary.orders)}
                  >
                    {summary.pricedCount ? formatOrderUsd(summary.value) : "—"}
                    {summary.pricedCount < summary.orders.length && (
                      <span className="block text-[10px] text-muted-foreground">
                        {summary.pricedCount}/{summary.orders.length} reported
                      </span>
                    )}
                  </Button>
                </TableCell>
                {(["completed", "active", "failed"] as const).map((status) => (
                  <TableCell key={status} className={cellClass}>
                    <Button
                      variant="ghost"
                      size="content"
                      type="button"
                      disabled={!summary.outcomes[status].length}
                      className={`${inspectClass} ${status === "failed" && summary.outcomes.failed.length ? "text-destructive" : ""}`}
                      onClick={() =>
                        inspect(
                          `${title} · ${status}`,
                          summary.outcomes[status],
                        )
                      }
                    >
                      {summary.outcomes[status].length.toLocaleString()}
                    </Button>
                  </TableCell>
                ))}
                <TableCell className={cellClass}>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    disabled={!summary.withErrors.length}
                    className={`${inspectClass} ${summary.withErrors.length ? "text-warning" : ""}`}
                    onClick={() =>
                      inspect(`${title} · execution errors`, summary.withErrors)
                    }
                  >
                    {summary.withErrors.length.toLocaleString()}
                  </Button>
                </TableCell>
              </>
            );
          }}
        />
      ) : (
        <EmptyState
          title="No matching routes"
          description="Try a token address, symbol, or network name."
        />
      )}
    </Panel>
  );
}

export function TokenRankings({
  tokens,
  inspect,
}: {
  tokens: TokenActivity[];
  inspect: Inspect;
}) {
  const [search, setSearch] = useState("");
  const [ranking, setRanking] = useState<Ranking>("orders");
  const filtered = useMemo(
    () =>
      sortRankings(
        tokens.filter((token) =>
          searchText(token.chainId, [token]).includes(
            search.trim().toLowerCase(),
          ),
        ),
        ranking,
        (token, side) => token[side].orders.length,
      ),
    [tokens, search, ranking],
  );
  return (
    <Panel
      title="Token involvement"
      description="Tokens stay separate by network and address. Involved placed value is order exposure; it overlaps across tokens and is not token trading volume. Same-token orders count once in involvement."
    >
      <p className="mb-4 text-xs text-muted-foreground">
        The same order can appear under both its input and output tokens. Do not
        sum token rows as platform volume.
      </p>
      <RankingsControl
        kind="tokens"
        search={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        ranking={ranking}
        onRanking={(value) => {
          setRanking(value);
        }}
      />
      <p role="status" className="mb-3 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()}{" "}
        {filtered.length === 1 ? "token" : "tokens"}
        {search.trim()
          ? filtered.length === 1
            ? " matches your search"
            : " match your search"
          : " in this view"}
      </p>
      {filtered.length ? (
        <ContinuousTable
          label="Token involvement rankings"
          items={filtered}
          itemKey={(token) => token.key}
          minWidth={1120}
          header={
            <TableRow>
              {[
                "Token",
                "Network",
                "Involved orders",
                "Involved placed value",
                "Input orders",
                "Output orders",
                "Active",
                "With errors",
              ].map((label) => (
                <TableHead
                  key={label}
                  scope="col"
                  className={`${cellClass} font-medium text-muted-foreground`}
                >
                  {label}
                </TableHead>
              ))}
            </TableRow>
          }
          rowContent={(token) => {
            const label = token.token?.symbol ?? token.address;
            return (
              <>
                <TableHead scope="row" className={cellClass}>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="content"
                      type="button"
                      className={inspectClass}
                      onClick={() =>
                        inspect(
                          `${label} · involved orders`,
                          token.summary.orders,
                        )
                      }
                    >
                      <TokenIdentity reference={token} />
                    </Button>
                    <TokenReferenceCopy reference={token} />
                  </div>
                </TableHead>
                <TableCell className={cellClass}>
                  <NetworkLabel chainId={token.chainId} />
                </TableCell>
                <TableCell className={cellClass}>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    className={inspectClass}
                    onClick={() =>
                      inspect(
                        `${label} · involved orders`,
                        token.summary.orders,
                      )
                    }
                  >
                    {token.summary.orders.length.toLocaleString()}
                  </Button>
                </TableCell>
                <TableCell className={cellClass}>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    className={inspectClass}
                    onClick={() =>
                      inspect(
                        `${label} · involved orders`,
                        token.summary.orders,
                      )
                    }
                  >
                    {token.summary.pricedCount
                      ? formatOrderUsd(token.summary.value)
                      : "—"}
                    <span className="block text-[10px] text-muted-foreground">
                      {token.summary.pricedCount}/{token.summary.orders.length}{" "}
                      reported
                    </span>
                  </Button>
                </TableCell>
                {(["input", "output"] as const).map((side) => (
                  <TableCell key={side} className={cellClass}>
                    <Button
                      variant="ghost"
                      size="content"
                      type="button"
                      disabled={!token[side].orders.length}
                      className={inspectClass}
                      onClick={() =>
                        inspect(`${label} · ${side} orders`, token[side].orders)
                      }
                    >
                      {token[side].orders.length.toLocaleString()}
                      <span className="block text-[10px] text-muted-foreground">
                        {token[side].pricedCount
                          ? formatOrderUsd(token[side].value)
                          : "—"}
                        {token[side].pricedCount <
                          token[side].orders.length && (
                          <span className="ml-1">
                            · {token[side].pricedCount}/
                            {token[side].orders.length} reported
                          </span>
                        )}
                      </span>
                    </Button>
                  </TableCell>
                ))}
                <TableCell className={cellClass}>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    disabled={!token.summary.outcomes.active.length}
                    className={inspectClass}
                    onClick={() =>
                      inspect(
                        `${label} · active orders`,
                        token.summary.outcomes.active,
                      )
                    }
                  >
                    {token.summary.outcomes.active.length.toLocaleString()}
                  </Button>
                </TableCell>
                <TableCell className={cellClass}>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    disabled={!token.summary.withErrors.length}
                    className={inspectClass}
                    onClick={() =>
                      inspect(
                        `${label} · execution errors`,
                        token.summary.withErrors,
                      )
                    }
                  >
                    {token.summary.withErrors.length.toLocaleString()}
                  </Button>
                </TableCell>
              </>
            );
          }}
        />
      ) : (
        <EmptyState
          title="No matching tokens"
          description="Try a token address, symbol, or network name."
        />
      )}
    </Panel>
  );
}
