import { Page } from "@/components/page";
import { OverviewSkeleton, PageSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <Page>
      <PageSkeleton>
        <OverviewSkeleton />
      </PageSkeleton>
    </Page>
  );
}
