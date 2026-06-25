import { URL_QUERY_KEYS } from "@/lib/consts";

export const PERPETUAL_HUB_SCOPED_QUERY_KEYS = [
  URL_QUERY_KEYS.CHAIN_ID,
  URL_QUERY_KEYS.CONTRACT,
] as const;

export function appendPerpetualHubScope(
  href: string,
  source?: URLSearchParams | null,
) {
  if (!source) return href;

  const [path, rawSearch = ""] = href.split("?");
  const params = new URLSearchParams(rawSearch);

  for (const key of PERPETUAL_HUB_SCOPED_QUERY_KEYS) {
    if (params.has(key)) continue;
    const values = source.getAll(key).filter(Boolean);
    for (const value of values) {
      params.append(key, value);
    }
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
