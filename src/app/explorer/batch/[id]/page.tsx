import { ExplorerBatch } from "@/components/explorer/batch/batch";

export default async function ExplorerBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExplorerBatch id={id} />;
}
