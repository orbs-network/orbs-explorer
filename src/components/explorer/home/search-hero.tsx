"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";

export function SearchHero() {
  const [q, setQ] = useState("");
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    router.push(ROUTES.EXPLORER.SEARCH(value));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-border bg-card p-2 sm:p-3"
    >
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sequence, state root, address, batch id, or L1 tx hash"
          className="h-11 w-full rounded-md bg-transparent pl-10 pr-12 font-mono text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Search the chain"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          disabled={!q.trim()}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </label>
    </form>
  );
}
