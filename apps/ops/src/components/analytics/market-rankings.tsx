"use client";

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
type Ranking = "value" | "orders" | "errors";

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
>(rows: T[], ranking: Ranking) {
  return rows.sort(
    (a, b) =>
      (ranking === "orders"
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
            <tr>
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
                <th
                  key={label}
                  scope="col"
                  className={`${cellClass} font-medium text-muted-foreground`}
                >
                  {label}
                </th>
              ))}
            </tr>
          }
          rowContent={(route) => {
            const { summary } = route;
            const title = `${route.input.token?.symbol ?? route.input.address} → ${route.output.token?.symbol ?? route.output.address}`;
            return (
              <>
                <th scope="row" className={cellClass}>
                  <div className="group/route flex items-center gap-1">
                    <button
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
                    </button>
                    {/* Copy actions stay out of the way until the row is in use. */}
                    <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/route:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
                      <TokenReferenceCopy reference={route.input} />
                      <TokenReferenceCopy reference={route.output} />
                    </span>
                  </div>
                </th>
                <td className={cellClass}>
                  <NetworkLabel chainId={route.chainId} />
                </td>
                <td className={cellClass}>
                  <button
                    type="button"
                    className={inspectClass}
                    onClick={() => inspect(title, summary.orders)}
                  >
                    {summary.orders.length.toLocaleString()}
                  </button>
                </td>
                <td className={cellClass}>
                  <button
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
                  </button>
                </td>
                {(["completed", "active", "failed"] as const).map((status) => (
                  <td key={status} className={cellClass}>
                    <button
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
                    </button>
                  </td>
                ))}
                <td className={cellClass}>
                  <button
                    type="button"
                    disabled={!summary.withErrors.length}
                    className={`${inspectClass} ${summary.withErrors.length ? "text-amber-700 dark:text-amber-400" : ""}`}
                    onClick={() =>
                      inspect(`${title} · execution errors`, summary.withErrors)
                    }
                  >
                    {summary.withErrors.length.toLocaleString()}
                  </button>
                </td>
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
      ),
    [tokens, search, ranking],
  );
  return (
    <Panel
      title="Token involvement"
      description="Tokens stay separate by network and address. Involved placed value is order exposure; it overlaps across tokens and is not token trading volume. Same-token orders count once in involvement."
    >
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
            <tr>
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
                <th
                  key={label}
                  scope="col"
                  className={`${cellClass} font-medium text-muted-foreground`}
                >
                  {label}
                </th>
              ))}
            </tr>
          }
          rowContent={(token) => {
            const label = token.token?.symbol ?? token.address;
            return (
              <>
                <th scope="row" className={cellClass}>
                  <div className="flex items-center gap-1">
                    <button
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
                    </button>
                    <TokenReferenceCopy reference={token} />
                  </div>
                </th>
                <td className={cellClass}>
                  <NetworkLabel chainId={token.chainId} />
                </td>
                <td className={cellClass}>
                  <button
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
                  </button>
                </td>
                <td className={cellClass}>
                  <button
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
                  </button>
                </td>
                {(["input", "output"] as const).map((side) => (
                  <td key={side} className={cellClass}>
                    <button
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
                    </button>
                  </td>
                ))}
                <td className={cellClass}>
                  <button
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
                  </button>
                </td>
                <td className={cellClass}>
                  <button
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
                  </button>
                </td>
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
