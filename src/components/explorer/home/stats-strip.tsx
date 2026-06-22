import { StatCard } from "@/components/explorer/ui/stat-card";
import { formatInteger, formatUsdCompact } from "@/lib/explorer/format";
import type { PerpetualHubSummary } from "@/lib/perpetual-hub/types";

type Props = { summary: PerpetualHubSummary | undefined };

function syncStatus(summary: PerpetualHubSummary | undefined): {
  label: string;
  tone: "success" | "warning" | "danger";
  sublabel: string;
} {
  if (!summary) return { label: "…", tone: "warning", sublabel: "loading" };
  const { sync, health } = summary;
  if (health.errors.length > 0) {
    return { label: "Issues", tone: "danger", sublabel: `${health.errors.length} error${health.errors.length === 1 ? "" : "s"}` };
  }
  if (sync.rollupPaused) {
    return { label: "Paused", tone: "warning", sublabel: sync.rollupPauseReason ?? "rollup paused" };
  }
  if (sync.rootsMatch === false) {
    return { label: "Drift", tone: "danger", sublabel: `gap ${sync.sequenceGap}` };
  }
  return {
    label: "OK",
    tone: "success",
    sublabel: sync.rootsMatch === true ? "roots match" : `gap ${sync.sequenceGap}`,
  };
}

export function StatsStrip({ summary }: Props) {
  const sync = syncStatus(summary);
  return (
    <section
      aria-label="Chain stats"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3"
    >
      <StatCard
        label="Seq height"
        value={summary ? `#${formatInteger(summary.sync.teeSeq)}` : "…"}
        sublabel="latest sequence"
      />
      <StatCard
        label="Batches"
        value={formatInteger(summary?.rollups.totalRollups)}
        sublabel="submitted"
      />
      <StatCard
        label="Total ops"
        value={formatInteger(summary?.rollups.totalOps)}
        sublabel="all-time"
      />
      <StatCard
        label="Addresses"
        value={formatInteger(summary?.risk.users)}
        sublabel="active"
      />
      <StatCard
        label="Open interest"
        value={summary ? formatUsdCompact(summary.risk.openInterest) : "…"}
        sublabel={
          summary
            ? `${summary.risk.openPositions} position${summary.risk.openPositions === 1 ? "" : "s"}`
            : ""
        }
      />
      <StatCard
        label="Sync"
        value={sync.label}
        sublabel={sync.sublabel}
        tone={sync.tone}
      />
    </section>
  );
}
