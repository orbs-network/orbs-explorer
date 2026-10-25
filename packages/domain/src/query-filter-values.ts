import { URL_QUERY_KEYS } from "./consts";

export const FILTER_ARRAY_KEYS = new Set<string>([
  URL_QUERY_KEYS.USER,
  URL_QUERY_KEYS.IN_TOKEN,
  URL_QUERY_KEYS.OUT_TOKEN,
  URL_QUERY_KEYS.PARTNER_ID,
  URL_QUERY_KEYS.CHAIN_ID,
  URL_QUERY_KEYS.ORDER_STATUS,
  URL_QUERY_KEYS.SESSION_ID,
  URL_QUERY_KEYS.ACTION_TYPE,
]);

export function filterQueryValue(key: string, values: string[]) {
  const unique = [...new Set(values.filter(Boolean))];
  return FILTER_ARRAY_KEYS.has(key)
    ? unique.length
      ? unique
      : undefined
    : unique[0] || undefined;
}

export function splitFilterValues(value: string) {
  return [
    ...new Set(
      value
        .split(/[,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
