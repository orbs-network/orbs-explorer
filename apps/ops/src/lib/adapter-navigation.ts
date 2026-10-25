type SearchValues = Record<string, string | string[] | undefined>;

/** Keep saved links working after consolidating the adapter tools. */
export function getLegacyAdapterRedirect(
  search: SearchValues,
  key: "security_view" | "data_view",
): string | undefined {
  const value = Array.isArray(search[key]) ? search[key][0] : search[key];
  if (value !== "adapters" && !(key === "security_view" && value === "address"))
    return;
  const params = new URLSearchParams();
  for (const [name, values] of Object.entries(search)) {
    if (name === key || name === "adapter_view") continue;
    for (const value of Array.isArray(values) ? values : values ? [values] : [])
      params.append(name, value);
  }
  if (value === "address") params.set("adapter_view", "address");
  return `/adapters${params.size ? `?${params}` : ""}`;
}
