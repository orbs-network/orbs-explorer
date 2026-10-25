"use client";

import { CheckCircle2, CircleAlert, Clock3, Info } from "lucide-react";
import { Badge } from "@orbs/ui/controls/badge";
import { Network } from "@orbs/ui/controls/network";
import type { AdapterComparison } from "@/lib/adapter-inventory";

export const adapterComparisonLabels: Record<AdapterComparison, string> = {
  current: "Current configuration",
  catalog: "Catalog only",
  unknown: "Not in catalog",
  "other-network": "Different network",
  unavailable: "Not checked",
  invalid: "Invalid address",
};

export function AdapterMatchBadge({
  comparison,
  knownNetworks = [],
  cached = false,
}: {
  comparison: AdapterComparison;
  knownNetworks?: number[];
  cached?: boolean;
}) {
  const unchecked =
    cached && comparison !== "invalid" && comparison !== "unavailable";
  const unknown = unchecked || comparison === "unavailable";
  const needsReview = ["invalid", "other-network", "unknown"].includes(
    comparison,
  );
  const Icon = unknown
    ? Info
    : comparison === "current"
      ? CheckCircle2
      : comparison === "catalog"
        ? Clock3
        : CircleAlert;
  const tone =
    unknown || comparison === "catalog"
      ? "text-muted-foreground"
      : needsReview
        ? "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : // The expected state stays quiet so exceptions stand out in long lists.
          "border-transparent bg-transparent px-0 text-success";
  return (
    <div className="space-y-1.5">
      <Badge variant="outline" className={`gap-1.5 ${tone}`}>
        <Icon aria-hidden />
        {unchecked ? "Cached result" : adapterComparisonLabels[comparison]}
      </Badge>
      {comparison === "other-network" &&
        !unchecked &&
        knownNetworks.length > 0 && (
          <div className="space-y-1 text-[11px] text-muted-foreground">
            <p>Catalog networks:</p>
            {knownNetworks.map((chainId) => (
              <Network
                key={chainId}
                chainId={chainId}
                variant="inline"
                showChainId={false}
                className="flex"
              />
            ))}
          </div>
        )}
    </div>
  );
}
