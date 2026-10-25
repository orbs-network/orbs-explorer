"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Link as LinkIcon, RefreshCw } from "lucide-react";
import { getSpotOrder } from "@orbs/domain/twap/api";
import { useSpotPartner } from "@orbs/domain/twap/hooks/use-spot-partner";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import { shortenAddress } from "@orbs/domain/utils/utils";
import { Button } from "@orbs/ui/controls/button";
import { Copy } from "@orbs/ui/controls/copy";
import { Spinner } from "@orbs/ui/controls/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";
import { EmptyState, Panel } from "@/components/operations/primitives";
import { OrderPayload } from "./order-payload";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import {
  fullOrderToInspectionOrder,
  isOrderHash,
  orderDetailHref,
  ordersScopeHref,
} from "@/lib/order-investigation";
import { useOrderScope } from "@/hooks/use-order-scope";
import { BackButton } from "@/components/back-button";
import { OrderLookup } from "./order-lookup";
import { ViewTabs } from "@/components/view-tabs";
import { OrderClientLogs } from "./order-client-logs";
import { OrderSourceOptions } from "./order-source-options";
import { OrderSummary, OrderTerms, OrderTimeline } from "./order-detail-parts";
import { spotOverviewOrdersQueryOptions } from "@/lib/spot-overview-queries";
import { matchingListOrder } from "@/lib/order-evidence";

export function OrderDetail({
  hash,
  source,
}: {
  hash: string;
  source?: "v1" | "v2";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navigationScope = useOrderScope();
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
  const historyOptions = spotOverviewOrdersQueryOptions();
  const cachedHistory = queryClient.getQueryData(historyOptions.queryKey);
  const cachedList = full
    ? matchingListOrder(full, cachedHistory ?? [])
    : undefined;
  const listUpdatedAt = queryClient.getQueryState(
    historyOptions.queryKey,
  )?.dataUpdatedAt;
  const chainId = getTwapOrderChainId(full ?? undefined);
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
  const adapterOrdersHref = adapter ? `/orders?${adapterSearch}` : undefined;
  return (
    <div className="space-y-4">
      <BackButton fallbackHref={ordersScopeHref(navigationScope)} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Order details
            </h1>
            <div className="rounded-md bg-muted/30 px-2" title={hash}>
              <Copy text={shortenAddress(hash)} value={hash} tooltip={hash} />
            </div>
          </div>
          {full && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Retrieved {formatOrderDate(query.dataUpdatedAt)}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About this order record"
                    className="rounded p-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Info aria-hidden className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Direct order lookup. Overview filters do not restrict this
                  record.
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!valid}
            aria-label="Copy order link"
            onClick={() =>
              copy(`${window.location.origin}${detailHrefForSource(source)}`)
            }
          >
            <LinkIcon aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Copy link</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!valid || query.isFetching}
            aria-label="Refresh order"
            onClick={() => void query.refetch()}
          >
            <RefreshCw
              aria-hidden
              className={`size-4 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            <span className="sm:hidden">Refresh</span>
            <span className="hidden sm:inline">Refresh order</span>
          </Button>
          {!full && valid && (
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
      </header>
      {query.isError && full && (
        <div role="alert" className="rounded-lg bg-amber-500/10 p-3 text-sm">
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
      ) : query.isPending ? (
        <div
          role="status"
          className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          <Spinner className="size-6" />
          Loading full order and execution history…
        </div>
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
                    appName={app.partnerName}
                    appId={app.partnerId}
                    queryString={searchParams.toString()}
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
      {!full && !query.isPending && (
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
  const [logs, setLogs] = useState(initial === "logs"),
    [payload, setPayload] = useState(initial === "payload");
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
      <details
        className="rounded-xl bg-card p-4"
        open={payload}
        onToggle={(event) => setPayload(event.currentTarget.open)}
      >
        <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
          Raw service data (JSON)
        </summary>
        {payload && (
          <div className="mt-4">
            <OrderPayload full={full} />
          </div>
        )}
      </details>
    </div>
  );
}
