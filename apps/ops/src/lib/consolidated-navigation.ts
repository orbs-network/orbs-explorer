import { globalScopeHref } from "./partner-navigation";

/** Preserve saved links when a repeated view moves to its canonical screen. */
export function consolidatedViewHref(
  pathname: string,
  search: string,
): string | undefined {
  const current = new URLSearchParams(search);
  const target = (path: string, fields: Record<string, string> = {}) => {
    const url = new URL(globalScopeHref(path, search), "https://ops.local");
    for (const [key, value] of Object.entries(fields))
      url.searchParams.set(key, value);
    return `${url.pathname}${url.search}`;
  };
  if (pathname === "/health") {
    const fields: Record<string, string> = { order_status: "active" };
    if (current.get("active_scope") !== "placement") fields.period = "all";
    switch (current.get("review_filter")) {
      case "past":
        fields.order_deadline = "past";
        break;
      case "soon":
        fields.order_deadline = "soon";
        break;
      case "latest":
        fields.order_errors = "latest";
        break;
      case "older":
        fields.order_active_age = "24h";
        break;
      case "all":
        break;
      default:
        fields.order_review = "attention";
    }
    return target("/orders", fields);
  }
  if (pathname === "/charts" && current.get("chart_view") === "breakdown") {
    const group = current.get("chart_group");
    return target("/performance", {
      performance_view:
        group === "networks" || group === "types" ? group : "apps",
      ...(current.get("chart_measure") === "value"
        ? { cohort_view: "sizes" }
        : {}),
    });
  }
  if (
    pathname === "/performance" &&
    current.get("performance_view") === "placement"
  )
    return target("/charts", { chart_view: "placement" });
  if (
    pathname === "/failures" &&
    ["apps", "networks"].includes(current.get("failure_view") ?? "")
  )
    return target("/performance", {
      performance_view: current.get("failure_view")!,
      cohort_view: "errors",
    });
  if (pathname === "/markets" && current.get("market_view") === "coverage")
    return target("/data-quality", { data_view: "fields" });
  if (pathname === "/markets" && current.get("market_view") === "demand")
    return target("/markets", { market_view: "tokens" });
  if (pathname === "/security" && current.get("security_view") === "orders")
    return target("/charts");
}
