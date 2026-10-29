import { redirect } from "next/navigation";
import { consolidatedViewHref } from "@/lib/consolidated-navigation";

/** Keep saved failure links useful within the consolidated Orders filters. */
export default async function FailuresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      params.append(key, item);
  }
  redirect(consolidatedViewHref("/failures", params.toString())!);
}
