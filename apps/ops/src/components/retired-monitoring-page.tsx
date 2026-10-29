import { redirect } from "next/navigation";
import { globalScopeHref } from "@/lib/partner-navigation";

/** Retired Monitoring bookmarks return to the same reporting scope. */
export async function RetiredMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      params.append(key, item);
  }
  redirect(globalScopeHref("/", params));
}
