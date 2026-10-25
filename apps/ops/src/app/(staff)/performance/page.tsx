import { OperationsView } from "@/components/operations/operations-view";
import { PerformanceView } from "@/components/analytics/performance-view";

export default function PerformancePage() {
  return (
    <OperationsView
      title="Order outcomes"
      description="Compare order outcomes across apps and networks."
    >
      <PerformanceView />
    </OperationsView>
  );
}
