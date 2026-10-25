import type { Metadata } from "next";
import { ExplorerBlock } from "@/components/explorer/block/block";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seq: string }>;
}): Promise<Metadata> {
  const { seq } = await params;
  return { title: `Block #${seq} — Orbs Explorer` };
}

export default async function ExplorerBlockPage({
  params,
}: {
  params: Promise<{ seq: string }>;
}) {
  const { seq } = await params;
  return <ExplorerBlock seq={seq} />;
}
