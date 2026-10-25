"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@orbs/ui/controls/input";
import { useAppSearch } from "@/hooks/use-app-search";
import { Spinner } from "@orbs/ui/controls/spinner";
import { cn } from "@orbs/domain/utils/utils";

export function SearchInput({
  className,
  placeholder = "Order ID or wallet address…",
  onSubmit,
}: {
  className?: string;
  placeholder?: string;
  onSubmit?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const { mutate: search, isPending } = useAppSearch();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const identifier = value.trim();
    if (!identifier || isPending) return;
    if (onSubmit) onSubmit(identifier);
    else search(identifier);
  };
  return (
    <form
      data-slot="order-search"
      role="search"
      onSubmit={submit}
      aria-busy={isPending}
      className={cn(
        "bg-card border border-control-border rounded-xl p-1.5 w-full flex gap-1 sm:gap-2 items-center h-14 sm:h-16 shadow-panel focus-within:border-primary transition-colors",
        className,
      )}
    >
      <Search aria-hidden className="ml-2 sm:ml-3 size-5 shrink-0 text-muted-foreground" />
      <Input
        name="identifier"
        aria-label="Order ID or wallet address"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-w-0 h-full rounded-none border-0 px-2 text-base bg-transparent"
      />
      <button
        type="submit"
        disabled={!value.trim() || isPending}
        aria-label={isPending ? "Searching…" : "Search"}
        className="bg-primary bg-action rounded-lg hover:brightness-[0.97] flex gap-2 items-center justify-center disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed h-11 min-w-11 sm:px-4 shrink-0 text-sm font-medium text-action-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {isPending ? (
          <Spinner size={16} />
        ) : (
          <>
            <span className="hidden sm:inline">Search</span>
            <ArrowRight aria-hidden size={18} />
          </>
        )}
      </button>
    </form>
  );
}
