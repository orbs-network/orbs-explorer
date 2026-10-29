import { Page } from "@/components/page";
import { PageSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <Page>
      <PageSkeleton />
    </Page>
  );
}
