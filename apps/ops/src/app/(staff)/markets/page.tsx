import { OperationsView } from "@/components/operations/operations-view";
import { MarketsView } from "@/components/analytics/markets-view";

export default function MarketsPage() {
  return (
    <OperationsView
      loadTokenMetadata
      title="Tokens & pairs"
      description="Explore traded tokens, pairs, and order value."
    >
      <MarketsView />
    </OperationsView>
  );
}
