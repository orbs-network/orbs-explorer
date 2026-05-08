import type { Metadata } from "next";
import { ExplorerAddress } from "@/components/explorer/address/address";

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ addr: string }>;
}): Promise<Metadata> {
  const { addr } = await params;
  return { title: `${shortAddress(addr)} — Orbs Explorer` };
}

export default async function ExplorerAddressPage({
  params,
}: {
  params: Promise<{ addr: string }>;
}) {
  const { addr } = await params;
  return <ExplorerAddress address={addr} />;
}
