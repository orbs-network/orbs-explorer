import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { OpTypePill } from "@/components/explorer/ui/op-type-pill";
import { RelativeTime } from "@/components/explorer/ui/relative-time";
import { Mono, formatId, truncateHash } from "@/components/explorer/ui/mono";
import { formatUsdShort } from "@/lib/explorer/format";
import type { PerpetualHubOperation } from "@/lib/perpetual-hub/types";

type Props = {
  events: PerpetualHubOperation[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

const ROW_LIMIT_DESKTOP = 15;

export function RecentBlocks({ events, isLoading, isError, onRetry }: Props) {
  const rows = (events ?? []).slice(0, ROW_LIMIT_DESKTOP);
  return (
    <FeedSection
      title="Recent blocks"
      hint="latest applied sequences"
      viewAllHref={ROUTES.EXPLORER.BLOCKS}
    >
      {isError ? (
        <FeedError label="Couldn't load recent blocks" onRetry={onRetry} />
      ) : isLoading ? (
        <SkeletonRows count={ROW_LIMIT_DESKTOP} cols={5} />
      ) : rows.length === 0 ? (
        <Empty>no recent blocks yet</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((op, i) => (
            <BlockRow key={`${op.teeSequence ?? "noseq"}-${op.id ?? i}`} op={op} />
          ))}
        </ul>
      )}
    </FeedSection>
  );
}

function BlockRow({ op }: { op: PerpetualHubOperation }) {
  const seq = op.teeSequence;
  const href = seq !== undefined ? ROUTES.EXPLORER.BLOCK(seq) : ROUTES.EXPLORER.ROOT;
  const amount = formatUsdShort(op.amount);
  return (
    <li>
      <Link
        href={href}
        className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_auto]"
      >
        <Mono className="text-sm text-foreground group-hover:text-primary">
          {seq !== undefined ? formatId(seq) : "—"}
        </Mono>
        <div className="flex items-center gap-2 min-w-0">
          <OpTypePill type={op.operationType} />
          {op.userAddress ? (
            <Mono className="hidden sm:inline truncate text-xs text-muted-foreground">
              {truncateHash(op.userAddress)}
            </Mono>
          ) : null}
        </div>
        <Mono className="hidden sm:inline text-xs text-muted-foreground text-right">
          {amount}
        </Mono>
        <RelativeTime timestamp={op.timestamp} className="text-xs" />
      </Link>
    </li>
  );
}

// — shared feed-section helpers (kept colocated for now) —

function FeedSection({
  title,
  hint,
  viewAllHref,
  children,
}: {
  title: string;
  hint?: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {title}
          </h2>
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <Link
          href={viewAllHref}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all →
        </Link>
      </header>
      {children}
    </section>
  );
}

function FeedError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="px-3 py-3">
      <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {label}.{" "}
        <button onClick={onRetry} className="underline underline-offset-2 hover:opacity-80">
          Retry
        </button>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-6 text-center text-xs text-muted-foreground">{children}</p>
  );
}

function SkeletonRows({ count, cols }: { count: number; cols: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <span
              key={c}
              className="block h-3 animate-pulse rounded bg-muted/60"
              style={{
                width: c === 1 ? "60%" : c === 0 ? "3.5rem" : "2.5rem",
              }}
            />
          ))}
        </li>
      ))}
    </ul>
  );
}

export { FeedSection, FeedError, Empty, SkeletonRows };
