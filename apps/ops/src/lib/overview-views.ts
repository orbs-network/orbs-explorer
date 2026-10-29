import { resolvePartnerId } from "./partner-navigation";
import { isOrderPeriod } from "./order-period";

export const OVERVIEW_VIEWS_STORAGE_KEY = "orbs.ops.saved-filter-views.v1";
export const MAX_SAVED_OVERVIEW_VIEWS = 10;
export const MAX_OVERVIEW_VIEW_NAME_LENGTH = 60;

export type SavedOverviewView = {
  id: string;
  name: string;
  query: string;
  createdAt: number;
};

const MAX_QUERY_LENGTH = 4096;
const signalViews = new Set(["activity", "rates", "review", "networks"]);

export function overviewViewName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  return name &&
    name.length <= MAX_OVERVIEW_VIEW_NAME_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : undefined;
}

/** Persist only supported Overview state, in a deterministic local query. */
export function canonicalOverviewQuery(query: string): string {
  if (query.length > MAX_QUERY_LENGTH) return "";
  const current = new URLSearchParams(query);
  const next = new URLSearchParams();
  const period = current.get("period");
  if (isOrderPeriod(period) && period !== "7") next.set("period", period);
  const chains = [
    ...new Set(
      current.getAll("chain_id").flatMap((value) => {
        const raw = value.trim();
        if (!/^\d+$/.test(raw)) return [];
        const id = Number(raw);
        return Number.isSafeInteger(id) && id >= 0 ? [id] : [];
      }),
    ),
  ].sort((a, b) => a - b);
  chains.forEach((chainId) => next.append("chain_id", String(chainId)));
  const partners = [
    ...new Set(
      current.getAll("partner_id").flatMap((value) => {
        const raw = value.trim();
        return /^[a-z0-9][a-z0-9_-]{0,127}$/i.test(raw)
          ? [resolvePartnerId(raw)]
          : [];
      }),
    ),
  ].sort();
  partners.forEach((partnerId) => next.append("partner_id", partnerId));
  if (current.get("show_inactive_partners") === "1")
    next.set("show_inactive_partners", "1");
  const signal = current.get("overview_signal_view");
  if (signal && signal !== "activity" && signalViews.has(signal))
    next.set("overview_signal_view", signal);
  if (current.get("pulse_window") === "168") next.set("pulse_window", "168");
  if (current.get("overview_group") === "networks")
    next.set("overview_group", "networks");
  if (current.get("active_scope") === "placement")
    next.set("active_scope", "placement");
  return next.toString();
}

function validateView(value: unknown): SavedOverviewView | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const record = value as Record<string, unknown>;
  const name = overviewViewName(record.name);
  if (
    !name ||
    typeof record.id !== "string" ||
    !/^[a-z0-9_-]{1,80}$/i.test(record.id) ||
    typeof record.query !== "string" ||
    record.query.length > MAX_QUERY_LENGTH ||
    !Number.isSafeInteger(record.createdAt) ||
    Number(record.createdAt) <= 0
  )
    return undefined;
  return {
    id: record.id,
    name,
    query: canonicalOverviewQuery(record.query),
    createdAt: Number(record.createdAt),
  };
}

export function parseSavedOverviewViews(
  raw: string | null,
): SavedOverviewView[] {
  if (!raw || raw.length > 100_000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return [];
    const data = parsed as Record<string, unknown>;
    if (data.version !== 1 || !Array.isArray(data.views)) return [];
    const ids = new Set<string>();
    return data.views.flatMap((value) => {
      const view = validateView(value);
      if (!view || ids.has(view.id) || ids.size >= MAX_SAVED_OVERVIEW_VIEWS)
        return [];
      ids.add(view.id);
      return [view];
    });
  } catch {
    return [];
  }
}

export function serializeSavedOverviewViews(
  views: readonly SavedOverviewView[],
): string {
  return JSON.stringify({
    version: 1,
    views: parseSavedOverviewViews(JSON.stringify({ version: 1, views })),
  });
}

/** Saved state can only navigate to the local Overview page. */
export function overviewViewHref(query: string): string {
  const canonical = canonicalOverviewQuery(query);
  return `/${canonical ? `?${canonical}` : ""}`;
}
