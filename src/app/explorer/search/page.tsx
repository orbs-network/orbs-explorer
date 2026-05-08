import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { resolveSearch } from "@/lib/explorer/resolver";

export default async function ExplorerSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const h = await headers();
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3003";
  const origin = `${proto}://${host}`;

  const result = await resolveSearch(q ?? "", origin);

  if (result.kind === "redirect") {
    redirect(result.target);
  }

  if (result.kind === "empty") {
    return (
      <SearchFallback
        title="Search"
        message="Type a sequence number, address, state root, batch id, or L1 tx hash."
      />
    );
  }

  return <SearchFallback title="Not found" message={result.reason} query={result.query} />;
}

function SearchFallback({
  title,
  message,
  query,
}: {
  title: string;
  message: string;
  query?: string;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-6">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Search
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {query ? (
        <p className="mt-3 break-all font-mono text-sm text-muted-foreground">
          <span className="text-muted-foreground/70">query:</span> {query}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <div className="mt-5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <FormatHint label="Sequence (block)">
          <code className="font-mono">12345</code>
        </FormatHint>
        <FormatHint label="Address">
          <code className="font-mono">0x… (40 hex)</code>
        </FormatHint>
        <FormatHint label="State root">
          <code className="font-mono">0x… (64 hex)</code>
        </FormatHint>
        <FormatHint label="L1 anchor tx">
          <code className="font-mono">0x… (64 hex)</code>
        </FormatHint>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={ROUTES.EXPLORER.ROOT}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to home
        </Link>
        <Link
          href={ROUTES.EXPLORER.BLOCKS}
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Browse blocks
        </Link>
      </div>
    </section>
  );
}

function FormatHint({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border/60 bg-background/40 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-foreground">{children}</p>
    </div>
  );
}
