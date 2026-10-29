"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCopy, RefreshCw } from "lucide-react";
import { getSpotOrder } from "@orbs/domain/twap/api";
import { REACT_QUERY_KEYS } from "@orbs/domain/consts";
import type { ListOrder } from "@orbs/domain/twap/types";
import { useSpotPartner } from "@orbs/domain/twap/hooks/use-spot-partner";
import { useSpotConfig } from "@orbs/domain/twap/hooks/use-spot-config";
import { useToken } from "@orbs/domain/hooks/use-token";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { shortenAddress } from "@orbs/domain/utils/utils";
import { Button } from "@orbs/ui/controls/button";
import { Copy } from "@orbs/ui/controls/copy";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";
import { OrderDetailSkeleton } from "@/components/loading-skeletons";
import { EmptyState, Panel } from "@/components/operations/primitives";
import { OrderPayload } from "./order-payload";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import {
  fullOrderToInspectionOrder,
  isOrderHash,
  orderDetailHref,
  ordersScopeHref,
} from "@/lib/order-investigation";
import { useOrderNavigationScope } from "@/hooks/use-order-navigation-scope";
import { partnerOrdersTabHref } from "@/lib/partner-navigation";
import { BackButton } from "@/components/back-button";
import { OrderLookup } from "./order-lookup";
import { ViewTabs } from "@/components/view-tabs";
import { OrderClientLogs } from "./order-client-logs";
import { OrderSourceOptions } from "./order-source-options";
import {
  OrderIdentity,
  OrderSummary,
  OrderTerms,
  OrderTimeline,
} from "./order-detail-parts";
import { matchingListOrder } from "@/lib/order-evidence";
import { ExportOrder } from "@/components/orders-overview/export-orders";
import { SnapshotFreshness } from "@/components/operations/snapshot-freshness";

export function OrderDetail({
  hash,
  source,
}: {
  hash: string;
  source?: "v1" | "v2";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigationScope = useOrderNavigationScope();
  const searchParams = useSearchParams();
  const copy = useCopy();
  const detailHrefForSource = (selectedSource?: "v1" | "v2") => {
    const href = orderDetailHref(hash, selectedSource, navigationScope);
    const view = searchParams.get("order_view");
    if (
      !view ||
      !["summary", "execution", "addresses", "logs", "payload"].includes(view)
    )
      return href;
    const [path, query] = href.split("?");
    const params = new URLSearchParams(query);
    params.set("order_view", view);
    return `${path}?${params}`;
  };
  const valid = isOrderHash(hash);
  const query = useQuery({
    queryKey: ["ops-order-inspection", source, hash],
    queryFn: async ({ signal }) =>
      (await getSpotOrder({ hash, source, signal })) ?? null,
    enabled: valid,
    staleTime: 60_000,
    retry: 1,
  });
  const full = query.data;
  const list = full ? fullOrderToInspectionOrder(full, source) : undefined;
  const cached = full
    ? queryClient
        .getQueryCache()
        .findAll({ queryKey: [REACT_QUERY_KEYS.spotOrders, "overview"] })
        .flatMap(({ state }) => {
          const order = matchingListOrder(
            full,
            Array.isArray(state.data) ? (state.data as ListOrder[]) : [],
          );
          return order ? [{ order, updatedAt: state.dataUpdatedAt }] : [];
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    : undefined;
  const cachedList = cached?.order;
  const listUpdatedAt = cached?.updatedAt;
  const chainId = getTwapOrderChainId(full ?? undefined);
  const configQuery = useSpotConfig();
  const inputToken = useToken(full?.order.witness.input?.token, chainId);
  const outputToken = useToken(full?.order.witness.output?.token, chainId);
  // Keep the initial placeholder until amounts and app identity can render
  // together. Cached content stays visible during subsequent refreshes.
  const isLoading =
    query.isPending ||
    Boolean(
      full &&
        (configQuery.isPending || inputToken.isLoading || outputToken.isLoading),
    );
  const app = useSpotPartner(full?.order.witness.exchange.adapter, chainId);
  const adapterSearch = new URLSearchParams(
    ordersScopeHref(navigationScope).split("?")[1],
  );
  adapterSearch.set("orders_view", "technical");
  if (chainId) {
    adapterSearch.delete("chain_id");
    adapterSearch.set("chain_id", String(chainId));
  }
  const adapter = full?.order.witness.exchange.adapter;
  if (adapter) adapterSearch.set("order_adapter", adapter);
  if (full?.source) adapterSearch.set("order_source", full.source);
  const adapterOrdersHref = adapter
    ? navigationScope.partnerId
      ? partnerOrdersTabHref(navigationScope.partnerId, {
          query: adapterSearch.toString(),
        })
      : `/orders?${adapterSearch}`
    : undefined;
  return (
    <div className="space-y-3">
      <nav aria-label="Order navigation">
        {navigationScope.partnerId ? (
          <Link
            href={partnerOrdersTabHref(
              navigationScope.partnerId,
              navigationScope,
            )}
            aria-label="Back to orders"
            className="inline-flex min-h-8 items-center gap-1.5 rounded text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to orders
          </Link>
        ) : (
          <BackButton fallbackHref={ordersScopeHref(navigationScope)} />
        )}
      </nav>
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Order details
          </h1>
          <div className="rounded-md bg-muted/30 px-2" title={hash}>
            <Copy text={shortenAddress(hash)} value={hash} tooltip={hash} />
          </div>
        </div>
        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {full && !isLoading && (
            <SnapshotFreshness
              updatedAt={query.dataUpdatedAt}
              refreshing={query.isFetching}
              failed={query.isError}
              mode="manual"
            />
          )}
          <div className="flex shrink-0 items-center gap-2">
            {full && list && !isLoading && (
              <ExportOrder
                order={full}
                summary={cachedList ?? list}
                retrievedAt={query.dataUpdatedAt}
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={!valid}
                  aria-label="Copy order link"
                  onClick={() =>
                    copy(
                      `${window.location.origin}${detailHrefForSource(source)}`,
                    )
                  }
                >
                  <ClipboardCopy aria-hidden className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy link</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={!valid || query.isFetching || isLoading}
                  aria-label="Refresh order"
                  aria-busy={query.isFetching || isLoading}
                  onClick={() => void query.refetch()}
                >
                  <RefreshCw
                    aria-hidden
                    className={`size-4 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {query.isFetching ? "Refreshing order" : "Refresh order"}
              </TooltipContent>
            </Tooltip>
            <span role="status" className="sr-only">
              {isLoading
                ? "Loading order details"
                : query.isFetching
                  ? "Refreshing order"
                  : query.isError
                    ? "Order refresh failed"
                    : full
                      ? "Order updated"
                      : ""}
            </span>
            {!full && valid && !isLoading && (
              <OrderSourceOptions
                value={source ?? "all"}
                onChange={(value) =>
                  router.push(
                    detailHrefForSource(
                      value === "all" ? undefined : (value as "v1" | "v2"),
                    ),
                    { scroll: false },
                  )
                }
              />
            )}
          </div>
        </div>
      </header>
      {query.isError && full && (
        <div role="alert" className="rounded-lg bg-warning-surface p-3 text-sm">
          <p className="font-medium">Order refresh failed</p>
          <p className="mt-1 text-muted-foreground">
            Showing the last successful record from{" "}
            {formatOrderDate(query.dataUpdatedAt)}. Refresh again or choose a
            service in Advanced.
          </p>
        </div>
      )}
      {!valid ? (
        <EmptyState
          title="Invalid order hash"
          description="Enter a full order hash beginning with 0x followed by 64 hexadecimal characters."
        />
      ) : isLoading ? (
        <OrderDetailSkeleton />
      ) : query.isError && !full ? (
        <div role="alert" className="rounded-xl bg-destructive/10 p-5">
          <h2 className="font-semibold">Order details could not be loaded</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The service could not confirm the result. Refresh or choose another
            service in Advanced.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : !full || !list ? (
        <EmptyState
          title="Order not found"
          description="Check the full hash or choose another service in Advanced."
        />
      ) : (
        <>
          <OrderIdentity
            full={full}
            list={list}
            appName={app.partnerName}
            appId={app.partnerId}
            queryString={searchParams.toString()}
          />
          <ViewTabs
            label="Order detail views"
            param="order_view"
            aliases={{ logs: "addresses", payload: "addresses" }}
            tabs={[
              {
                value: "summary",
                label: "Summary",
                content: (
                  <OrderSummary
                    retrievedAt={query.dataUpdatedAt}
                    full={full}
                    list={list}
                    cachedList={cachedList}
                    listUpdatedAt={listUpdatedAt}
                  />
                ),
              },
              {
                value: "execution",
                label: "Execution history",
                content: <OrderTimeline full={full} />,
              },
              {
                value: "addresses",
                label: "Technical",
                content: (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-4">
                      <p className="text-sm font-medium">Order source</p>
                      <OrderSourceOptions
                        value={source ?? "all"}
                        onChange={(value) =>
                          router.push(
                            detailHrefForSource(
                              value === "all"
                                ? undefined
                                : (value as "v1" | "v2"),
                            ),
                            { scroll: false },
                          )
                        }
                      />
                    </div>
                    <OrderTerms
                      full={full}
                      appName={app.partnerName}
                      requestedSource={source}
                      updatedAt={query.dataUpdatedAt}
                      adapterOrdersHref={adapterOrdersHref}
                    />
                    <TechnicalEvidence
                      key={hash}
                      hash={hash}
                      full={full}
                      initial={searchParams.get("order_view")}
                    />
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
      {!full && !isLoading && (
        <Panel title="Look up another order">
          <OrderLookup
            initialHash={valid ? "" : hash}
            navigationScope={navigationScope}
          />
        </Panel>
      )}
    </div>
  );
}

function TechnicalEvidence({
  hash,
  full,
  initial,
}: {
  hash: string;
  initial: string | null;
  full: Parameters<typeof OrderPayload>[0]["full"];
}) {
  const [logs, setLogs] = useState(initial === "logs");
  return (
    <div className="space-y-4">
      <details
        className="rounded-xl bg-card p-4"
        open={logs}
        onToggle={(event) => setLogs(event.currentTarget.open)}
      >
        <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
          Client logs
        </summary>
        {logs && (
          <div className="mt-4">
            <OrderClientLogs hash={hash} />
          </div>
        )}
      </details>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4">
        <h2 className="text-sm font-medium">Raw service data</h2>
        <OrderPayload full={full} defaultOpen={initial === "payload"} />
      </section>
    </div>
  );
}
