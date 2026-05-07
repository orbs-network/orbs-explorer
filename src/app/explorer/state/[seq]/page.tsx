import { Placeholder } from "@/components/explorer/placeholder";

export default async function ExplorerStatePage({
  params,
}: {
  params: Promise<{ seq: string }>;
}) {
  const { seq } = await params;
  return (
    <Placeholder
      title={`State at sequence ${seq}`}
      identifier={seq}
      hint="Power-user view: Merkle root, metrics, exposure, top addresses at a snapshot."
    />
  );
}
