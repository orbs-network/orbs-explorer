import { PARTNERS } from "@orbs/domain/partners";
import { isOrderPeriod } from "./order-period";
import type { SpotConfig } from "@orbs/domain/twap/types";
import { getPartnerByAdapter } from "@orbs/domain/twap/utils/orders-overview";
import {
  ordersScopeHref,
  type InvestigationFilters,
  type OrderNavigationScope,
} from "./order-investigation";

export const PARTNER_VIEWS = [
  {
    value: "overview",
    label: "Overview",
    description:
      "Start with this app’s order totals, value, and latest activity.",
  },
  {
    value: "orders",
    label: "Orders",
    description: "Search and filter this app’s order history.",
  },
] as const;

export type PartnerView = (typeof PARTNER_VIEWS)[number]["value"];
export const PARTNER_TABS = [
  { value: "overview", label: "Overview", views: ["overview"] },
  { value: "orders", label: "Orders", views: ["orders"] },
] as const satisfies readonly {
  value: string;
  label: string;
  views: readonly PartnerView[];
}[];

export type ScopeSearch = string | Pick<URLSearchParams, "get" | "getAll">;

const partnerAliases = new Map(
  PARTNERS.flatMap((partner) =>
    [partner.id, ...partner.identifiers].map(
      (alias) => [alias.toLowerCase(), partner.id] as const,
    ),
  ),
);

/** Retain configured custom IDs while resolving registered aliases and adapters. */
export function resolvePartnerId(
  value: string,
  config?: SpotConfig | null,
  chainIds: readonly string[] = [],
): string {
  const id = value.trim();
  const normalized = id.toLowerCase();
  if (normalized.startsWith("adapter-") && config) {
    const resolved = getPartnerByAdapter(
      config,
      normalized.slice("adapter-".length),
      chainIds.length ? chainIds.map(Number) : undefined,
    );
    if (resolved) return resolved.partnerId;
  }
  return (
    partnerAliases.get(normalized) ??
    (normalized.startsWith("adapter-") ? normalized : id)
  );
}

export type LegacyPartnerView =
  | "health"
  | "progress"
  | "failures"
  | "lookup"
  | "activity"
  | "outcomes"
  | "networks"
  | "charts"
  | "markets"
  | "routes"
  | "tokens";

export function getPartnerView(value?: string | null): PartnerView {
  const canonical = ["health", "progress", "failures", "lookup"].includes(
    value ?? "",
  )
    ? "orders"
    : value;
  return (
    PARTNER_VIEWS.find((view) => view.value === canonical)?.value ?? "overview"
  );
}

/** Old execution links now open the one Orders table with the same app scope. */
export function legacyPartnerOrdersHref(
  partnerId: string,
  search: ScopeSearch,
): string | undefined {
  const current =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const view = current.get("view");
  if (!["health", "progress", "failures", "lookup"].includes(view ?? ""))
    return;
  const params = partnerScopeSearch(partnerId, search);
  params.set("view", "orders");
  if (view === "health" || view === "progress") {
    if (current.get("active_scope") !== "placement")
      params.set("period", "all");
    if (view !== "progress" || current.get("progress_scope") !== "all")
      params.set("order_status", "active");
    if (view === "health") {
      const review = current.get("review_filter");
      if (review === "past" || review === "soon")
        params.set("order_deadline", review);
      else if (review === "latest") params.set("order_errors", "latest");
      else if (review === "older") params.set("order_active_age", "24h");
      else if (review !== "all") params.set("order_review", "attention");
    }
  } else if (view === "failures") params.set("order_status", "failed");
  params.delete("partner_id");
  return `/partners/${encodeURIComponent(resolvePartnerId(partnerId))}?${params}`;
}

function normalizedChainIds(values: readonly string[]): string[] {
  return [
    ...new Set(
      values.flatMap((value) => {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) return [];
        const chainId = Number(trimmed);
        // Zero is the overview's explicit "Network not provided" filter bucket.
        return Number.isSafeInteger(chainId) && chainId >= 0
          ? [String(chainId)]
          : [];
      }),
    ),
  ];
}

/** Only global filters travel between operational views. */
function globalScopeSearch(
  search: ScopeSearch,
  partnerIdOverride?: string,
  chainIdsOverride?: readonly string[],
): URLSearchParams {
  const current =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const params = new URLSearchParams();
  const period = current.get("period");
  if (isOrderPeriod(period)) {
    params.set("period", period);
  }
  for (const chainId of normalizedChainIds(
    chainIdsOverride ?? current.getAll("chain_id"),
  )) {
    params.append("chain_id", chainId);
  }
  const partners =
    partnerIdOverride === undefined
      ? current.getAll("partner_id")
      : [partnerIdOverride];
  for (const partnerId of new Set(
    partners.map((value) => resolvePartnerId(value)).filter(Boolean),
  )) {
    params.append("partner_id", partnerId);
  }
  return params;
}

export function partnerScopeSearch(
  partnerId: string,
  search: ScopeSearch,
  chainIdsOverride?: readonly string[],
): URLSearchParams {
  return globalScopeSearch(search, partnerId, chainIdsOverride);
}

/** Open the shared list within its partner, retaining explicit cohort facets. */
export function partnerOrdersTabHref(
  partnerId: string,
  scope: OrderNavigationScope,
): string {
  const params = new URLSearchParams(ordersScopeHref(scope).split("?")[1]);
  params.delete("partner_id");
  params.set("view", "orders");
  return `/partners/${encodeURIComponent(resolvePartnerId(partnerId))}?${params}`;
}

/** A partner drilldown describes the displayed cohort, not hidden Orders facets. */
export function partnerOrdersHref(
  partnerId: string,
  search: ScopeSearch,
  filters: Partial<Pick<InvestigationFilters, "status" | "errors">> & {
    deadline?: "past" | "soon" | "unreported";
  } = {},
  chainIdsOverride?: readonly string[],
): string {
  const params = partnerScopeSearch(partnerId, search, chainIdsOverride);
  if (filters.status && filters.status !== "all")
    params.set("order_status", filters.status);
  if (filters.errors && filters.errors !== "all")
    params.set("order_errors", filters.errors);
  if (filters.deadline) params.set("order_deadline", filters.deadline);
  return partnerOrdersTabHref(partnerId, { query: params.toString() });
}

export function partnerHref(
  partnerId: string,
  search: ScopeSearch,
  view: PartnerView | LegacyPartnerView = "overview",
  chainIdsOverride?: readonly string[],
): string {
  const id = resolvePartnerId(partnerId);
  const params = partnerScopeSearch(id, search, chainIdsOverride);
  const legacy = legacyPartnerOrdersHref(
    id,
    new URLSearchParams([...params, ["view", view]]),
  );
  if (legacy) return legacy;
  const selectedView = getPartnerView(view);
  if (selectedView !== "overview") params.set("view", selectedView);
  // The route owns this scope; query partners are needed only on global pages.
  params.delete("partner_id");
  return `/partners/${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`;
}

/** Entering All orders from a partner clears the app scope; other links retain it. */
export function globalScopeHref(
  pathname: string,
  search: ScopeSearch,
  partnerIdOverride?: string,
): string {
  if (
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    /[\\?#\u0000-\u001f]/.test(pathname)
  ) {
    throw new TypeError("Operational navigation requires a local pathname.");
  }
  const params = globalScopeSearch(search, partnerIdOverride);
  if (pathname === "/orders" && partnerIdOverride !== undefined)
    params.delete("partner_id");
  return `${pathname}${params.size ? `?${params.toString()}` : ""}`;
}
