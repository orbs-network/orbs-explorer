import { OperationsView } from "@/components/operations/operations-view";
import { AdaptersView } from "@/components/adapters/adapters-view";

export default function AdaptersPage() {
  return (
    <OperationsView
      title="Adapters"
      exportAction={null}
      description="Review adapter addresses and their order activity."
    >
      <AdaptersView />
    </OperationsView>
  );
}
