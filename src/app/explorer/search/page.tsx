import { Placeholder } from "@/components/explorer/placeholder";
import { classifySearchInput } from "@/lib/explorer/search";

export default async function ExplorerSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const parsed = classifySearchInput(q ?? "");

  return (
    <Placeholder
      title="Search"
      identifier={parsed.trimmed || "(no query)"}
      hint={`Detected: ${parsed.kind}. Resolution logic lands in PR 6.`}
    />
  );
}
