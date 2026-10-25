import { OperationsView } from "@/components/operations/operations-view";
import { DataQualityView } from "@/components/operations/data-quality-view";
import { redirect } from "next/navigation";
import { getLegacyAdapterRedirect } from "@/lib/adapter-navigation";

export default async function DataQualityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const href = getLegacyAdapterRedirect(await searchParams, "data_view");
  if (href) redirect(href);
  return (
    <OperationsView
      title="Data checks"
      description="Review missing fields and inconsistent records."
    >
      <DataQualityView />
    </OperationsView>
  );
}
