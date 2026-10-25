import { PARTNERS } from "@orbs/domain/partners";
import type { SpotConfig } from "@orbs/domain/twap/types";
import { getPartnerByAdapter } from "@orbs/domain/twap/utils/orders-overview";
import {
  ordersScopeHref,
  type InvestigationFilters,
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
    label: "Browse orders",
    description: "Search and filter this app’s order history.",
  },
  {
    value: "lookup",
    label: "Find by order hash",
    description:
      "Open a specific order using its full hash, including older orders.",
  },
  {
    value: "health",
    label: "Active orders",
    description: "Check orders still running and approaching deadlines.",
  },
  {
    value: "progress",
    label: "Execution progress",
    description: "See how much of each order has executed and what is left.",
  },
  {
    value: "failures",
    label: "Failed orders & errors",
    description: "Understand execution errors and why orders failed.",
  },
  {
    value: "activity",
    label: "Activity over time",
    description: "See when orders were placed and how activity changes.",
  },
  {
    value: "outcomes",
    label: "Order outcomes",
    description: "Compare completed, active, cancelled, and failed orders.",
  },
  {
    value: "networks",
    label: "Activity by network",
    description: "Compare order activity across blockchain networks.",
  },
  {
    value: "routes",
    label: "Swap pairs",
    description: "Explore which token pairs are traded most often.",
  },
  {
    value: "tokens",
    label: "Tokens",
    description: "See individual tokens and their order activity.",
  },
] as const;

export type PartnerView = (typeof PARTNER_VIEWS)[number]["value"];
export const PARTNER_TABS = [
  { value: "overview", label: "Overview", views: ["overview"] },
  { value: "orders", label: "Orders", views: ["orders", "lookup"] },
  {
    value: "execution",
    label: "Execution",
    views: ["health", "progress", "failures"],
  },
  {
    value: "activity",
    label: "Activity",
    views: ["activity", "outcomes", "networks"],
  },
  { value: "markets", label: "Markets", views: ["routes", "tokens"] },
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

export function getPartnerView(value?: string | null): PartnerView {
  const canonical =
    value === "charts" ? "activity" : value === "markets" ? "routes" : value;
  return (
    PARTNER_VIEWS.find((view) => view.value === canonical)?.value ?? "overview"
  );
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
  if (period === "7" || period === "30" || period === "all") {
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
  return ordersScopeHref({ query: params.toString() });
}

export function partnerHref(
  partnerId: string,
  search: ScopeSearch,
  view: PartnerView | "charts" | "markets" = "overview",
  chainIdsOverride?: readonly string[],
): string {
  const id = resolvePartnerId(partnerId);
  const params = partnerScopeSearch(id, search, chainIdsOverride);
  const selectedView = getPartnerView(view);
  if (selectedView !== "overview") params.set("view", selectedView);
  return `/partners/${encodeURIComponent(id)}?${params.toString()}`;
}

/** A route-level partner always takes precedence over unrelated query partners. */
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
  return `${pathname}${params.size ? `?${params.toString()}` : ""}`;
}
