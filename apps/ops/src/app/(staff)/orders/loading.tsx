import { Page } from "@/components/page";
import { PageSkeleton, TableSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <Page>
      <PageSkeleton>
        <TableSkeleton />
      </PageSkeleton>
    </Page>
  );
}
