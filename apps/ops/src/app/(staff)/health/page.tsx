"use client";

import { ExecutionHealth } from "@/components/execution/execution-health";
import { OperationsView } from "@/components/operations/operations-view";

export default function ExecutionHealthPage() {
  return (
    <OperationsView
      title="Active orders"
      description="Review active orders, deadlines, and execution issues."
      timeBasis="current"
    >
      <ExecutionHealth />
    </OperationsView>
  );
}
