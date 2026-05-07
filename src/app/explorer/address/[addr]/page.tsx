import { Placeholder } from "@/components/explorer/placeholder";

export default async function ExplorerAddressPage({
  params,
}: {
  params: Promise<{ addr: string }>;
}) {
  const { addr } = await params;
  return (
    <Placeholder
      title="Address"
      identifier={addr}
      hint="Balance, positions, orders, and history tabs land here in PR 5."
    />
  );
}
