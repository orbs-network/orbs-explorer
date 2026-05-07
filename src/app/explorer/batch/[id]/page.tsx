import { Placeholder } from "@/components/explorer/placeholder";

export default async function ExplorerBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Placeholder
      title={`Batch #${id}`}
      identifier={id}
      hint="L1 anchor tx, sequence range, and contained sequences land here in PR 4."
    />
  );
}
