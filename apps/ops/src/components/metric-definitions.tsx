"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@orbs/ui/controls/dialog";

const definitions = [
  [
    "Executed volume / trading wallets",
    "Unavailable in the history feed. Trading volume needs successful fill amounts and actual execution times, counted once on one swap leg, with historical USD prices and coverage. Trading-wallet counts need the executing wallet identity and a stated cross-network deduplication policy. Neither is derived from placed value or chunk-count percentages.",
  ],
  [
    "Placement period comparisons",
    "The last 24 hours, 7 days, or 30 days are rolling ranges ending at the retrieved snapshot, compared with the immediately preceding equal duration. The previous range excludes its end boundary. Growth describes available placed orders and known USD, with price coverage shown; it is not execution growth or an incident signal. All history has no equal prior period.",
  ],
  [
    "Placed value",
    "Reported original order size in USD. It is not executed value or trading volume. Missing USD values are excluded and coverage is shown where available.",
  ],
  [
    "Current outcomes",
    "Completed, partly completed, active, failed, cancelled, expired and unknown are mutually exclusive current outcomes. Their counts add up to the scoped placed orders.",
  ],
  [
    "Failed orders / failure rate",
    "Currently failed orders divided by all placed orders in the same placement cohort. Cancelled and expired orders are separate outcomes. A small denominator does not establish an incident.",
  ],
  [
    "Latest attempt failed",
    "Unique orders whose latest reported execution attempt failed. This can overlap any current outcome. It is neither a count of attempts nor a count of terminal failures.",
  ],
  [
    "Active · latest attempt failed",
    "The active subset of orders whose latest reported attempt failed. They may still retry. Retry timing, exhaustion and intervention requirements are not inferred.",
  ],
  [
    "Completed after errors",
    "Currently completed orders with reported execution error history. Completion is reported; the app does not infer that recovery was automatic.",
  ],
  [
    "Active past deadline",
    "Orders still reported active whose usable reported deadline is at or before the evaluated order snapshot. This is a review signal, not proof of a stuck worker or an SLA breach.",
  ],
  [
    "Active 24h+",
    "Active orders placed at least 24 hours before the evaluated snapshot. Long duration alone is not an execution failure.",
  ],
  [
    "Cancelled / expired / partly completed",
    "Separate current outcomes from the service. Cancellation actor and cause are not assumed. Expiration is not counted as a technical failure. Execution detail shows available amounts and attempts.",
  ],
  [
    "Reporting and active-order periods",
    "Reporting filters select placement cohorts. Active-order review links include all placement dates unless explicitly narrowed to the reporting range. Deadline and latest-attempt filters describe reported order state at the retrieved snapshot.",
  ],
] as const;

export function MetricDefinitions() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Metric definitions"
          title="Metric definitions"
        >
          <CircleHelp aria-hidden className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Metric definitions</DialogTitle>
          <DialogDescription>
            How Orbs Spot counts outcomes and evaluates review signals.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border text-xs">
          {definitions.map(([term, detail]) => (
            <div key={term} className="py-3">
              <dt className="font-medium">{term}</dt>
              <dd className="mt-1.5 leading-relaxed text-muted-foreground">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
