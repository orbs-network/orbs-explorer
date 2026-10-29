export type PagePosition = { href: string; top: number };

/** Query controls describe a page's state; a selected partner order is its own page. */
export function pageIdentity(href: string): string | undefined {
  if (!href.startsWith("/") || href.startsWith("//")) return undefined;
  try {
    const url = new URL(href, "https://orbs.local");
    if (url.origin !== "https://orbs.local") return undefined;
    const partnerOrder = /^\/partners\/[^/]+\/?$/.test(url.pathname)
      ? url.searchParams.get("order_hash")?.toLowerCase()
      : undefined;
    return `${url.pathname}${partnerOrder ? `?order_hash=${partnerOrder}` : ""}`;
  } catch {
    return undefined;
  }
}

export function previousPageIndex(
  positions: Record<number, PagePosition>,
  currentIndex: number,
  currentHref: string,
): number | undefined {
  const currentPage = pageIdentity(currentHref);
  if (!currentPage) return undefined;
  return Object.keys(positions)
    .map(Number)
    .filter(
      (index) =>
        Number.isSafeInteger(index) && index >= 0 && index < currentIndex,
    )
    .sort((a, b) => b - a)
    .find((index) => {
      const identity = pageIdentity(positions[index].href);
      return identity !== undefined && identity !== currentPage;
    });
}
