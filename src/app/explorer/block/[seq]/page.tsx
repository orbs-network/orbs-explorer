import { Placeholder } from "@/components/explorer/placeholder";

export default async function ExplorerBlockPage({
  params,
}: {
  params: Promise<{ seq: string }>;
}) {
  const { seq } = await params;
  return (
    <Placeholder
      title={`Block #${seq}`}
      identifier={seq}
      hint="Transition + State tabs land here in PR 3."
    />
  );
}
