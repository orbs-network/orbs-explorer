import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function ExplorerNotFound() {
  return (
    <section className="rounded-lg border border-border bg-card p-8">
      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Not found
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        That route doesn&apos;t exist in the explorer.
      </p>
      <Link
        href={ROUTES.EXPLORER.ROOT}
        className="mt-6 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Back to home
      </Link>
    </section>
  );
}
