"use client";

import { useEffect, useId, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { usePartner } from "@orbs/domain/hooks/use-partner";
import { getChainLogo } from "@orbs/domain/utils/utils";
import { useSpotConfig } from "@orbs/domain/twap/hooks/use-spot-config";
import { Avatar, AvatarFallback, AvatarImage } from "@orbs/ui/controls/avatar";
import { Button } from "@orbs/ui/controls/button";
import { Skeleton } from "@orbs/ui/skeleton";
import {
  InlineSkeleton,
  OrderDetailSkeleton,
  PartnerOverviewSkeleton,
  TableSkeleton,
} from "@/components/loading-skeletons";
import { OrderFilters } from "@/components/order-filters";
import { Page } from "@/components/page";
import { PartnerViewTabs } from "./partner-view-tabs";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import { OperationsDataProvider } from "@/components/operations/operations-view";
import { useOrderScope } from "@/hooks/use-order-scope";
import { useSpotOverview } from "@/hooks/use-spot-overview";
import { useInvestigationFilters } from "@/hooks/use-investigation-filters";
import { buildSpotOverview } from "@/lib/overview-data";
import {
  PARTNER_VIEWS,
  getPartnerView,
  partnerHref,
  legacyPartnerOrdersHref,
  partnerScopeSearch,
  resolvePartnerId,
  type PartnerView,
} from "@/lib/partner-navigation";

const PartnerOverview = dynamic(
  () => import("./partner-overview").then((module) => module.PartnerOverview),
  { loading: PartnerOverviewSkeleton },
);
const PartnerOrders = dynamic(
  () => import("./partner-orders").then((module) => module.PartnerOrders),
  { loading: () => <TableSkeleton label="Loading partner orders" /> },
);
const PartnerOrderDetail = dynamic(
  () =>
    import("../investigation/order-detail").then(
      (module) => module.OrderDetail,
    ),
  { loading: OrderDetailSkeleton },
);

function PartnerViewContent({
  partnerId,
  view,
}: {
  partnerId: string;
  view: PartnerView;
}) {
  switch (view) {
    case "orders":
      return <PartnerOrders />;
    default:
      return <PartnerOverview partnerId={partnerId} />;
  }
}

export function PartnerWorkspace({
  partnerId: requestedId,
}: {
  partnerId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryScope = useOrderScope();
  const selectId = useId();
  const search = searchParams.toString();
  const { data: partnerConfig } = useSpotConfig();
  const requestedScope = partnerScopeSearch(
    resolvePartnerId(requestedId),
    search,
  );
  const partnerId = resolvePartnerId(
    requestedId,
    partnerConfig,
    requestedScope.getAll("chain_id"),
  );
  const view = getPartnerView(searchParams.get("view"));
  const orderHash = searchParams.get("order_hash");
  const orderSource = searchParams.get("source");
  const source =
    orderSource === "v1" || orderSource === "v2" ? orderSource : undefined;
  useEffect(() => {
    const legacy = legacyPartnerOrdersHref(partnerId, search);
    if (legacy) {
      router.replace(legacy, { scroll: false });
    } else if (
      ["markets", "routes", "tokens"].includes(
        new URLSearchParams(search).get("view") ?? "",
      )
    ) {
      router.replace(partnerHref(partnerId, search, "overview"), {
        scroll: false,
      });
    } else if (
      (requestedId.toLowerCase().startsWith("adapter-") &&
        partnerId !== requestedId.toLowerCase()) ||
      new URLSearchParams(search).has("partner_id")
    ) {
      // Clean old bookmarks without dropping applied order filters or paging.
      const params = new URLSearchParams(search);
      params.delete("partner_id");
      router.replace(
        `/partners/${encodeURIComponent(partnerId)}${params.size ? `?${params}` : ""}`,
        { scroll: false },
      );
    }
  }, [partnerId, requestedId, router, search, view]);
  const normalized = useMemo(
    () => partnerScopeSearch(partnerId, search),
    [partnerId, search],
  );
  const chainIds = useMemo(() => normalized.getAll("chain_id"), [normalized]);
  const partnerIds = useMemo(() => [partnerId], [partnerId]);
  const scope: ReturnType<typeof useOrderScope> = {
    ...queryScope,
    chainIds,
    partnerIds,
    key: `${queryScope.period}:${chainIds.join(",")}:${partnerId}`,
    setPeriod: (period) => {
      const params = new URLSearchParams(normalized);
      if (period) params.set("period", period);
      else params.delete("period");
      router.push(partnerHref(partnerId, params, view), { scroll: false });
    },
    setChains: (networks) =>
      router.push(partnerHref(partnerId, search, view, networks), {
        scroll: false,
      }),
    setPartners: (partners) => {
      if (partners[0]) router.push(partnerHref(partners[0], search, view));
    },
    applyFilters: (selection, extra = {}) => {
      const params = new URLSearchParams(normalized);
      params.set("period", selection.period);
      const href = partnerHref(partnerId, params, view, selection.chainIds);
      const [pathname, query] = href.split("?");
      const next = new URLSearchParams(query);
      next.delete("table_page_order_investigation_results");
      for (const [key, value] of Object.entries(extra)) {
        if (value === undefined) next.delete(key);
        else next.set(key, value);
      }
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    reset: () =>
      router.push(partnerHref(partnerId, "", view), { scroll: false }),
  };
  const { filters } = useInvestigationFilters();
  const data = useSpotOverview({
    ...scope,
    loadTokenMetadata: view === "orders",
    filters: view === "orders" ? filters : undefined,
    enabled: orderHash === null,
  });
  // Identity and network choices cover this partner's catalog/retrieved history, even
  // when the selected period or networks contain no matching orders.
  const catalog = useMemo(
    () =>
      buildSpotOverview({
        allOrders: data.allOrders,
        config: data.config,
        updatedAt: data.updatedAt,
        partnerIds,
      }),
    [data.allOrders, data.config, data.updatedAt, partnerIds],
  );
  const identity = catalog.partnerOptions.find(
    (option) => option.value === partnerId,
  );
  const partner = usePartner(partnerId);
  const identityLoading = data.isCatalogLoading && !identity && !partner;
  const partnerName = identity?.label ?? partner?.name ?? "Partner";
  const networks =
    catalog.partnerCards.find((card) => card.partnerId === partnerId)?.chains ??
    [];
  const networkOptions = networks.map((network) => ({
    value: String(network.chainId),
    chainId: network.chainId,
    label: network.chainName,
    logo: getChainLogo(network.chainId),
  }));
  const activeView = PARTNER_VIEWS.find((option) => option.value === view)!;
  const activeNetworks = data.networkActivity.filter(
    (network) => network.chainId > 0 && network.orders.length,
  ).length;
  const unattributedOrders =
    data.networkActivity.find((network) => network.chainId === 0)?.orders
      .length ?? 0;
  const lastPlaced = useMemo(
    () =>
      data.orders.reduce<number | undefined>((latest, order) => {
        const placed = Date.parse(order.timestamp);
        return Number.isFinite(placed) && placed > 0
          ? Math.max(latest ?? 0, placed)
          : latest;
      }, undefined),
    [data.orders],
  );
  const partnerIdentity = (
    <div className="flex min-w-0 items-center gap-3">
      {identityLoading ? (
        <Skeleton className="size-9 shrink-0 rounded-[10px]" />
      ) : (
        <Avatar aria-hidden className="size-9 shrink-0 rounded-[10px]">
          <AvatarImage src={partner?.logo} alt="" />
          <AvatarFallback className="rounded-[10px] text-sm">
            {partnerName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight">
        {identityLoading ? (
          <InlineSkeleton label="Loading trading app" className="h-6 w-28" />
        ) : (
          partnerName
        )}
      </h1>
    </div>
  );

  return (
    <Page>
      <div className="space-y-3 sm:space-y-4">
        {orderHash === null && (
          <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            {partnerIdentity}
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {data.isLoading ? (
                <InlineSkeleton
                  label="Loading partner summary"
                  className="w-64"
                />
              ) : (
                <>
                  <span>
                    {activeNetworks}{" "}
                    {activeNetworks === 1 ? "network" : "networks"} with orders
                    {unattributedOrders
                      ? ` · ${unattributedOrders} orders without a reported network`
                      : ""}
                  </span>
                  <span>
                    {lastPlaced
                      ? `Last order ${formatOrderDate(lastPlaced)}`
                      : "No orders placed in this view"}
                  </span>
                </>
              )}
              {view !== "orders" &&
                (data.isLoading ? (
                  <InlineSkeleton
                    label="Preparing order export"
                    className="h-8 w-24"
                  />
                ) : (
                  <ExportOrders
                    orders={data.orders}
                    snapshotAt={data.updatedAt}
                  />
                ))}
            </div>
          </header>
        )}
        {orderHash !== null ? (
          <PartnerOrderDetail
            key={`${partnerId}:${orderHash}:${source ?? "all"}`}
            hash={orderHash}
            source={source}
          />
        ) : (
          <PartnerViewTabs
            partnerId={partnerId}
            search={search}
            view={view}
            controls={
              <OrderFilters
                isLoading={data.isLoading}
                scope={scope}
                networkOptions={networkOptions}
                partnerOptions={catalog.partnerOptions}
                partner={{ id: partnerId, label: partnerName }}
                orderTypes={
                  view === "orders"
                    ? [
                        ...new Set(
                          data.orders.map(
                            (order) =>
                              order.metadata.orderType?.trim() || "unreported",
                          ),
                        ),
                      ].sort()
                    : undefined
                }
              />
            }
          >
            <div className="min-w-0 space-y-4">
              {data.warnings.map((warning) => (
                <p
                  key={warning}
                  role="status"
                  className="rounded-[8px] bg-warning-surface p-3 text-sm"
                >
                  {warning}
                </p>
              ))}
              {data.isLoading ? (
                view === "orders" ? (
                  <TableSkeleton label="Loading partner orders" />
                ) : (
                  <PartnerOverviewSkeleton />
                )
              ) : data.isError ? (
                <div
                  role="alert"
                  className="rounded-[12px] bg-destructive/10 p-5"
                >
                  <h2 className="font-semibold">
                    Partner activity is unavailable
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The complete order snapshot could not be loaded.
                  </p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={data.retry}
                  >
                    Try again
                  </Button>
                </div>
              ) : !identity ? (
                <section
                  aria-labelledby={`${selectId}-missing`}
                  className="rounded-[12px] bg-muted/40 p-8 text-center"
                >
                  <h2 id={`${selectId}-missing`} className="font-medium">
                    Partner not found
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                    This partner is not in the current configuration or loaded
                    order history. Return to Overview to choose another app.
                  </p>
                </section>
              ) : (
                <OperationsDataProvider
                  key={`${scope.key}:${view}`}
                  data={data}
                  scope={scope}
                  scopeLabel={`${partnerName} · reporting period and selected networks`}
                >
                  <section
                    aria-label={`${activeView.label} for ${partnerName}`}
                    className="space-y-4"
                  >
                    <h2 className="sr-only">{activeView.label}</h2>
                    <PartnerViewContent partnerId={partnerId} view={view} />
                  </section>
                </OperationsDataProvider>
              )}
            </div>
          </PartnerViewTabs>
        )}
      </div>
    </Page>
  );
}
