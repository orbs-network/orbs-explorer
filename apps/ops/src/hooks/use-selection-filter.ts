"use client";

import { StringParam, useQueryParams } from "use-query-params";

export function useSelectionFilter(
  key: string,
  initialValue: string,
  allowed: readonly string[],
) {
  const [query, setQuery] = useQueryParams({ [key]: StringParam });
  const selected = query[key];
  const value =
    selected && allowed.includes(selected) ? selected : initialValue;
  return [
    value,
    (next: string) =>
      setQuery({ [key]: next === initialValue ? undefined : next }, "pushIn"),
  ] as const;
}
