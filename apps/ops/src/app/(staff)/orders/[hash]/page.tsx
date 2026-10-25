import { OrderDetail } from "@/components/investigation/order-detail";
import { Page } from "@/components/page";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ hash: string }>;
  searchParams: Promise<{ source?: string | string[] }>;
}) {
  const [{ hash }, query] = await Promise.all([params, searchParams]);
  const source =
    query.source === "v1" || query.source === "v2" ? query.source : undefined;
  return (
    <Page>
      <OrderDetail
        key={`${hash}:${source ?? "all"}`}
        hash={hash}
        source={source}
      />
    </Page>
  );
}
