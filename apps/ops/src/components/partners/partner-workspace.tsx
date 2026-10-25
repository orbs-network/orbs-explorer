"use client";

import { useEffect, useId, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { usePartner } from "@orbs/domain/hooks/use-partner";
import { getChainLogo } from "@orbs/domain/utils/utils";
import { useSpotConfig } from "@orbs/domain/twap/hooks/use-spot-config";
import { Avatar, AvatarFallback, AvatarImage } from "@orbs/ui/controls/avatar";
import { Button } from "@orbs/ui/controls/button";
import { Spinner } from "@orbs/ui/controls/spinner";
import { OrderFilters } from "@/components/order-filters";
import { Page } from "@/components/page";
import { PartnerViewTabs } from "./partner-view-tabs";
import { ExportOrders } from "@/components/orders-overview/export-orders";
import { SnapshotFreshness } from "@/components/operations/snapshot-freshness";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@orbs/ui/controls/select";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import { OperationsDataProvider } from "@/components/operations/operations-view";
import { useOrderScope } from "@/hooks/use-order-scope";
import { useSpotOverview } from "@/hooks/use-spot-overview";
import { buildSpotOverview } from "@/lib/overview-data";
import { useOperationalScope } from "@/hooks/use-operational-scope";
import { OperationalScopeControl } from "@/components/operations/operational-scope-control";
import { ordersScopeHref } from "@/lib/order-investigation";
import {
  PARTNER_VIEWS,
  getPartnerView,
  globalScopeHref,
  partnerHref,
  partnerOrdersHref,
  partnerScopeSearch,
  resolvePartnerId,
  type PartnerView,
} from "@/lib/partner-navigation";

function PreparingView() {
  return (
    <p
      role="status"
      className="py-12 text-center text-sm text-muted-foreground"
    >
      Preparing partner view…
    </p>
  );
}

const PartnerOverview = dynamic(
  () => import("./partner-overview").then((module) => module.PartnerOverview),
  { loading: PreparingView },
);
const PartnerActivity = dynamic(
  () => import("./partner-activity").then((module) => module.PartnerActivity),
  { loading: PreparingView },
);
const PartnerOutcomes = dynamic(
  () => import("./partner-outcomes").then((module) => module.PartnerOutcomes),
  { loading: PreparingView },
);
const PartnerNetworks = dynamic(
  () => import("./partner-networks").then((module) => module.PartnerNetworks),
  { loading: PreparingView },
);
const PartnerActiveOrders = dynamic(
  () =>
    import("./partner-execution").then(
      (module) => module.PartnerExecutionHealth,
    ),
  { loading: PreparingView },
);
const PartnerProgress = dynamic(
  () =>
    import("./partner-execution").then(
      (module) => module.PartnerExecutionProgress,
    ),
  { loading: PreparingView },
);
const PartnerFailures = dynamic(
  () => import("./partner-failures").then((module) => module.PartnerFailures),
  { loading: PreparingView },
);
const PartnerRoutes = dynamic(
  () => import("./partner-markets").then((module) => module.PartnerRoutes),
  { loading: PreparingView },
);
const PartnerTokens = dynamic(
  () => import("./partner-markets").then((module) => module.PartnerTokens),
  { loading: PreparingView },
);
const PartnerOrders = dynamic(
  () => import("./partner-orders").then((module) => module.PartnerOrders),
  { loading: PreparingView },
);
const PartnerLookup = dynamic(
  () => import("./partner-orders").then((module) => module.PartnerOrderLookup),
  { loading: PreparingView },
);

function PartnerViewContent({
  partnerId,
  view,
}: {
  partnerId: string;
  view: PartnerView;
}) {
  switch (view) {
    case "activity":
      return <PartnerActivity />;
    case "outcomes":
      return <PartnerOutcomes partnerId={partnerId} />;
    case "networks":
      return <PartnerNetworks partnerId={partnerId} />;
    case "health":
      return <PartnerActiveOrders />;
    case "progress":
      return <PartnerProgress />;
    case "failures":
      return <PartnerFailures partnerId={partnerId} />;
    case "routes":
      return <PartnerRoutes />;
    case "tokens":
      return <PartnerTokens />;
    case "orders":
      return <PartnerOrders />;
    case "lookup":
      return <PartnerLookup />;
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
  useEffect(() => {
    if (
      requestedId.toLowerCase().startsWith("adapter-") &&
      partnerId !== requestedId.toLowerCase()
    ) {
      router.replace(partnerHref(partnerId, search, view), { scroll: false });
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
  const data = useSpotOverview({
    ...scope,
    loadTokenMetadata: ["orders", "routes", "tokens"].includes(view),
  });
  const currentView = view === "health" || view === "progress";
  const operational = useOperationalScope(data, scope, currentView);
  const viewData = currentView ? operational.data : data;
  const viewScope = currentView ? operational.scope : scope;
  // Identity and network choices cover this partner's full catalog/history, even
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
  const partnerName = identity?.label ?? "Partner";
  const partner = usePartner(partnerId);
  const networks =
    catalog.partnerCards.find((card) => card.partnerId === partnerId)?.chains ??
    [];
  const networkOptions = networks.map((network) => ({
    value: String(network.chainId),
    chainId: network.chainId,
    label: network.chainName,
    logo: getChainLogo(network.chainId),
  }));
  const allPartnersParams = new URLSearchParams(normalized);
  allPartnersParams.delete("partner_id");
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

  return (
    <Page>
      <div className="space-y-4 sm:space-y-5">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link
            href={globalScopeHref("/", allPartnersParams)}
            className="rounded-sm text-link hover:underline"
          >
            Overview
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          <span aria-current="page">{partnerName}</span>
        </nav>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar aria-hidden className="size-11 shrink-0 rounded-[10px]">
              <AvatarImage src={partner?.logo} alt="" />
              <AvatarFallback className="rounded-[10px] text-sm">
                {partnerName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
                {partnerName}
              </h1>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {data.isLoading
                  ? "Loading partner activity…"
                  : `${activeNetworks} ${activeNetworks === 1 ? "network" : "networks"} with orders${unattributedOrders ? ` · ${unattributedOrders} orders without a reported network` : ""} · ${lastPlaced ? `Last order ${formatOrderDate(lastPlaced)}` : "No orders placed in this view"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Select
              value={partnerId}
              onValueChange={(value) => scope.setPartners([value])}
            >
              <SelectTrigger
                aria-label="Switch trading app"
                className="w-auto gap-2 text-xs"
              >
                <SelectValue>Switch app</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!identity && (
                  <SelectItem value={partnerId}>
                    {data.isLoading ? "Loading partners…" : "Partner not found"}
                  </SelectItem>
                )}
                {catalog.partnerOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.updatedAt > 0 && (
              <SnapshotFreshness
                updatedAt={data.updatedAt}
                refreshing={data.isRefreshing}
                failed={data.isRefreshError}
              />
            )}
            {view !== "orders" && <ExportOrders orders={viewData.orders} />}
            <Button
              variant="outline"
              size="icon"
              disabled={data.isRefreshing}
              onClick={data.refresh}
              aria-label="Refresh partner data"
              title="Refresh partner data"
            >
              <RefreshCw
                aria-hidden
                className={`size-4 ${data.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
              />
            </Button>
          </div>
        </header>
        <OrderFilters
          periodLabel={
            currentView && operational.placement === "all"
              ? null
              : "Order placement period"
          }
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
        {data.warnings.map((warning) => (
          <p
            key={warning}
            role="status"
            className="rounded-[8px] bg-amber-500/10 p-3 text-sm"
          >
            {warning}
          </p>
        ))}
        <PartnerViewTabs partnerId={partnerId} search={search} view={view}>
          {/* Inside the tabs so switching sections never moves the tab bar. */}
          <div className="min-w-0 space-y-4">
            {currentView && (
              <OperationalScopeControl
                {...operational}
                period={scope.period}
                isLoading={data.isLoading}
                isUnavailable={data.isError}
              />
            )}
            {data.isLoading ? (
              <div
                role="status"
                className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"
              >
                <Spinner className="size-6" />
                Loading partner activity…
              </div>
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
                <Button className="mt-3" variant="outline" onClick={data.retry}>
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
                  order history. Use Switch trading app to choose another app.
                </p>
              </section>
            ) : (
              <OperationsDataProvider
                key={`${viewScope.key}:${view}`}
                data={viewData}
                scope={viewScope}
                scopeLabel={`${partnerName} · ${currentView && operational.placement === "all" ? "all placement dates" : "reporting period"} and selected networks`}
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
      </div>
    </Page>
  );
}
