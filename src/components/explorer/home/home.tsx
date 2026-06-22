"use client";

import { useExplorerHome } from "@/lib/explorer/hooks";
import { StatsStrip } from "./stats-strip";
import { SearchHero } from "./search-hero";
import { RecentBlocks } from "./recent-blocks";
import { RecentBatches } from "./recent-batches";

export function ExplorerHome() {
  const query = useExplorerHome();
  const summary = query.data;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {summary && (summary.health.errors.length > 0 || summary.sync.rollupPaused) ? (
        <HealthBanner
          paused={!!summary.sync.rollupPaused}
          pauseReason={summary.sync.rollupPauseReason}
          errors={summary.health.errors}
        />
      ) : null}

      <StatsStrip summary={summary} />

      <SearchHero />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <RecentBlocks
          events={summary?.activity.recentEvents}
          isLoading={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
        />
        <RecentBatches
          rollups={summary?.rollups.latest}
          isLoading={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
        />
      </div>
    </div>
  );
}

function HealthBanner({
  paused,
  pauseReason,
  errors,
}: {
  paused: boolean;
  pauseReason?: string;
  errors: string[];
}) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {paused ? (
        <p className="font-medium">
          Rollups paused{pauseReason ? `: ${pauseReason}` : ""}.
        </p>
      ) : null}
      {errors.length > 0 ? (
        <ul className="mt-1 list-inside list-disc">
          {errors.slice(0, 3).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {errors.length > 3 ? <li>and {errors.length - 3} more</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
