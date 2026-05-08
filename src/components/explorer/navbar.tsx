"use client";

import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

type NavLink = { href: string; label: string; exact?: boolean };

const NAV_LINKS: readonly NavLink[] = [
  { href: ROUTES.EXPLORER.ROOT, label: "Home", exact: true },
  { href: ROUTES.EXPLORER.BLOCKS, label: "Blocks" },
  { href: ROUTES.EXPLORER.BATCHES, label: "Batches" },
];

export function ExplorerNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(ROUTES.EXPLORER.SEARCH(q));
  };

  const searchForm = (
    <form onSubmit={onSubmit} className="w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sequence, address, hash, or batch id"
          className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Search the explorer"
        />
      </div>
    </form>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Row 1: logo + (md+) nav + (md+) search */}
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          href={ROUTES.EXPLORER.ROOT}
          className="flex items-center gap-2 shrink-0"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground font-mono text-[11px] font-bold">
            O
          </span>
          <span className="font-semibold tracking-tight">Orbs Explorer</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden md:block w-full max-w-md">
          {searchForm}
        </div>
      </div>

      {/* Row 2 (mobile only): search form gets its own full-width row */}
      <div className="md:hidden border-t border-border px-3 py-2">
        {searchForm}
      </div>

      {/* Row 3 (mobile only): nav links */}
      <nav className="md:hidden border-t border-border bg-background/60">
        <div className="mx-auto flex max-w-[1400px] items-center gap-1 px-2 py-1.5">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
