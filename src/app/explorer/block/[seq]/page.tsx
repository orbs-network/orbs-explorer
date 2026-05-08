import { ExplorerBlock } from "@/components/explorer/block/block";

export default async function ExplorerBlockPage({
  params,
}: {
  params: Promise<{ seq: string }>;
}) {
  const { seq } = await params;
  return <ExplorerBlock seq={seq} />;
}
