import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { StatusBadge } from "@/components/explorer/ui/status-badge";
import { RelativeTime } from "@/components/explorer/ui/relative-time";
import { Mono, formatId } from "@/components/explorer/ui/mono";
import { formatInteger } from "@/lib/explorer/format";
import {
  FeedSection,
  FeedError,
  Empty,
  SkeletonRows,
} from "@/components/explorer/home/recent-blocks";
import type { PerpetualHubSummary } from "@/lib/perpetual-hub/types";

type Props = {
  rollups: PerpetualHubSummary["rollups"]["latest"] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

const ROW_LIMIT_DESKTOP = 10;

export function RecentBatches({ rollups, isLoading, isError, onRetry }: Props) {
  const rows = (rollups ?? []).slice(0, ROW_LIMIT_DESKTOP);
  return (
    <FeedSection
      title="Recent batches"
      hint="rollups submitted to L1"
      viewAllHref={ROUTES.EXPLORER.BATCHES}
    >
      {isError ? (
        <FeedError label="Couldn't load recent batches" onRetry={onRetry} />
      ) : isLoading ? (
        <SkeletonRows count={ROW_LIMIT_DESKTOP} cols={4} />
      ) : rows.length === 0 ? (
        <Empty>no recent batches yet</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((b) => (
            <BatchRow key={b.id} batch={b} />
          ))}
        </ul>
      )}
    </FeedSection>
  );
}

function BatchRow({
  batch,
}: {
  batch: PerpetualHubSummary["rollups"]["latest"][number];
}) {
  return (
    <li>
      <Link
        href={ROUTES.EXPLORER.BATCH(batch.id)}
        className="group grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40"
      >
        <Mono className="text-sm text-foreground group-hover:text-primary">
          {formatId(batch.id)}
        </Mono>
        <StatusBadge status={batch.status} />
        <Mono className="truncate text-xs text-muted-foreground">
          seq {formatInteger(batch.oldSequence)}–{formatInteger(batch.newSequence)}
          <span className="hidden sm:inline">
            {" "}· {formatInteger(batch.operationsCount)} op
            {batch.operationsCount === 1 ? "" : "s"}
          </span>
        </Mono>
        <RelativeTime timestamp={batch.submittedAt} className="text-xs" />
      </Link>
    </li>
  );
}
