import type { PerpetualHubRollup } from "@orbs/domain/perpetual-hub/types";
import type { ActivityTone } from "./order-story";

export function isSettlementConfirmed(rollup?: PerpetualHubRollup) {
  if (!rollup || /fail|error|reject/i.test(rollup.status)) return false;
  return (
    rollup.status.toUpperCase() === "CONFIRMED" || Boolean(rollup.confirmedAt)
  );
}

export function getSettlementStory(rollup: PerpetualHubRollup) {
  const confirmed = isSettlementConfirmed(rollup);
  const failed = /fail|error|reject/i.test(rollup.status);
  return {
    title: confirmed
      ? "Settlement batch confirmed"
      : failed
        ? "Settlement batch reports an error"
        : "Settlement confirmation pending",
    tone: (confirmed
      ? "success"
      : failed
        ? "error"
        : "pending") as ActivityTone,
    explanation: `This batch groups ${rollup.operationsCount} account ${rollup.operationsCount === 1 ? "change" : "changes"} into one blockchain transaction. The changes are listed below. A transaction ID alone does not establish confirmation.`,
    nextStep: rollup.txHash
      ? "Open the blockchain record to check its confirmation, or select a change to see what happened."
      : "No blockchain transaction is available yet. Refresh to check for confirmation.",
  };
}
