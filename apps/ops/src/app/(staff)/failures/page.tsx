"use client";

import { FailureAnalysis } from "@/components/execution/failure-analysis";
import { OperationsView } from "@/components/operations/operations-view";

export default function FailuresPage() {
  return (
    <OperationsView
      title="Errors & failures"
      description="Review failures and execution errors by app or network."
    >
      <FailureAnalysis />
    </OperationsView>
  );
}
