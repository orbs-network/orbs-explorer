import { Page } from "@/components/page";
import { OrderDetailSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <Page>
      <OrderDetailSkeleton />
    </Page>
  );
}
