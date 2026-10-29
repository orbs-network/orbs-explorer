import { Page } from "@/components/page";
import {
  PageSkeleton,
  PartnerOverviewSkeleton,
} from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <Page>
      <PageSkeleton>
        <PartnerOverviewSkeleton />
      </PageSkeleton>
    </Page>
  );
}
