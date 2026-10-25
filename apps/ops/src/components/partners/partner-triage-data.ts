import type { PartnerChainEntry } from "@orbs/domain/twap/utils/orders-overview";
import { getOverviewOrderStatus } from "@orbs/domain/twap/utils/orders-overview";
import { deadlineTime, placementTime } from "../../lib/execution-analytics";
import { hasLastExecutionError } from "../../lib/order-diagnostics";

/** Current order signals from the same placed-order cohort as the partner view. */
export function buildPartnerNetworkTriage(
  networks: PartnerChainEntry[],
  snapshot: number,
) {
  return networks.map((network) => {
    let failed = 0;
    let overdue = 0;
    let latestErrors = 0;
    let latestPlaced: number | undefined;
    for (const order of network.orders) {
      const status = getOverviewOrderStatus(order);
      if (status === "failed") failed++;
      const deadline = deadlineTime(order);
      if (status === "active" && deadline !== undefined && deadline <= snapshot)
        overdue++;
      if (hasLastExecutionError(order)) latestErrors++;
      const placed = placementTime(order);
      if (placed !== undefined)
        latestPlaced = Math.max(latestPlaced ?? 0, placed);
    }
    return {
      ...network,
      failed,
      overdue,
      latestErrors,
      latestPlaced,
      failureRate: network.orders.length
        ? failed / network.orders.length
        : undefined,
    };
  });
}
