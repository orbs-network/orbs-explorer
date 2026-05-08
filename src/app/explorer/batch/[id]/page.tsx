import type { Metadata } from "next";
import { ExplorerBatch } from "@/components/explorer/batch/batch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Batch #${id} — Orbs Explorer` };
}

export default async function ExplorerBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExplorerBatch id={id} />;
}
