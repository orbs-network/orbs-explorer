import { redirect } from "next/navigation";
import { consolidatedViewHref } from "@/lib/consolidated-navigation";

/** Keep bookmarked active-order queues pointing at the canonical Orders screen. */
export default async function ActiveOrdersRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      params.append(key, item);
  }
  redirect(consolidatedViewHref("/health", params.toString())!);
}
