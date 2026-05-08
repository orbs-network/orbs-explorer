import { ExplorerAddress } from "@/components/explorer/address/address";

export default async function ExplorerAddressPage({
  params,
}: {
  params: Promise<{ addr: string }>;
}) {
  const { addr } = await params;
  return <ExplorerAddress address={addr} />;
}
