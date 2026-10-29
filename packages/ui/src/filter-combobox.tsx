"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "./controls/button";
import { Input } from "./controls/input";
import { Avatar, AvatarFallback, AvatarImage } from "./controls/avatar";
import { NetworkIcon } from "./controls/network";
import { cn } from "@orbs/domain/utils/utils";

export type FilterOption = {
  label: string;
  value: string;
  logo?: string;
  chainId?: number;
};

function OptionIcon({ option }: { option: FilterOption }) {
  if (option.chainId !== undefined)
    return (
      <NetworkIcon
        chainId={option.chainId}
        name={option.label}
        className="size-4 shrink-0"
      />
    );
  if (!option.logo) return null;
  return (
    <Avatar className="size-4 shrink-0">
      <AvatarImage src={option.logo} alt="" />
      <AvatarFallback className="text-[8px]">
        {option.label.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
}

export function FilterCombobox({
  label,
  options,
  value,
  onChange,
  mode = "single",
  placeholder,
  emptyLabel = "No selection",
}: {
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  mode?: "single" | "multiple";
  placeholder?: string;
  emptyLabel?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState({
    side: "below" as "above" | "below",
    maxHeight: 280,
  });
  const selected = useMemo(() => new Set(value), [value]);
  const selectedLabels = value.map(
    (item) => options.find((option) => option.value === item)?.label ?? item,
  );
  const selectedIcons = value
    .flatMap((item) => {
      const option = options.find((option) => option.value === item);
      return option && (option.logo || option.chainId !== undefined)
        ? [option]
        : [];
    })
    .slice(0, 3);
  const summary =
    selectedLabels.length > 1
      ? `${selectedLabels[0]} + ${selectedLabels.length - 1} more`
      : (selectedLabels[0] ?? emptyLabel);
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return options.filter(
      (option) =>
        !term ||
        option.label.toLowerCase().includes(term) ||
        option.value.toLowerCase().includes(term),
    );
  }, [options, search]);

  const showOptions = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    const scroller = rootRef.current
      ?.closest("[data-filter-scroll]")
      ?.getBoundingClientRect();
    if (rect) {
      const below =
        Math.min(window.innerHeight, scroller?.bottom ?? window.innerHeight) -
        rect.bottom;
      const above = rect.top - Math.max(0, scroller?.top ?? 0);
      const side = below < 240 && above > below ? "above" : "below";
      setPlacement({
        side,
        maxHeight: Math.max(
          96,
          Math.min(280, (side === "above" ? above : below) - 8),
        ),
      });
    }
    setOpen(true);
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    setSearch("");
    setActive(-1);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const select = (option: FilterOption) => {
    onChange(
      mode === "single"
        ? [option.value]
        : selected.has(option.value)
          ? value.filter((item) => item !== option.value)
          : [...value, option.value],
    );
    setSearch("");
    setActive(-1);
    if (mode === "single") close(true);
    else inputRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false);
        setSearch("");
        setActive(-1);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => {
    if (open && active >= 0)
      listRef.current
        ?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) =>
        event.key === "ArrowDown"
          ? Math.min(index + 1, matches.length - 1)
          : index < 0
            ? matches.length - 1
            : Math.max(0, index - 1),
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : matches.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const exact = matches.find(
        (option) =>
          option.label.toLowerCase() === search.trim().toLowerCase() ||
          option.value.toLowerCase() === search.trim().toLowerCase(),
      );
      const option = matches[active] ?? exact;
      if (option) select(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };
  return (
    <div
      ref={rootRef}
      className="min-w-0 space-y-1.5"
      data-vaul-no-drag
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-options`}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-selection`}
          className="h-10 w-full justify-between gap-2 px-3 text-left text-sm font-normal"
          onClick={() => (open ? close() : showOptions())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              showOptions();
              setActive(event.key === "ArrowDown" ? 0 : matches.length - 1);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            }
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedIcons.length > 0 && (
              <span aria-hidden className="flex shrink-0 -space-x-1">
                {selectedIcons.map((option) => (
                  <OptionIcon key={option.value} option={option} />
                ))}
              </span>
            )}
            <span
              className={cn(
                "truncate",
                !value.length && "text-muted-foreground",
              )}
            >
              {summary}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        </Button>
        {open && (
          <div
            data-slot="filter-options"
            className={cn(
              "absolute z-[60] flex w-full flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
              placement.side === "above" ? "bottom-full mb-1" : "top-full mt-1",
            )}
            style={{ maxHeight: placement.maxHeight }}
          >
            <div className="flex shrink-0 items-center gap-1 border-b border-border p-2">
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={inputRef}
                  type="search"
                  aria-label={`Search ${label.toLowerCase()}`}
                  aria-controls={`${id}-options`}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    active >= 0 && matches[active]
                      ? `${id}-option-${active}`
                      : undefined
                  }
                  autoComplete="off"
                  spellCheck={false}
                  value={search}
                  placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
                  className="h-8 pl-8 text-xs"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={handleSearchKey}
                />
              </div>
              {value.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Clear ${label.toLowerCase()}`}
                  title={`Clear ${label.toLowerCase()}`}
                  className="size-8 shrink-0"
                  onClick={() => {
                    onChange([]);
                    setSearch("");
                    setActive(-1);
                    inputRef.current?.focus();
                  }}
                >
                  <X aria-hidden className="size-3.5" />
                </Button>
              )}
            </div>
            <div
              ref={listRef}
              id={`${id}-options`}
              role="listbox"
              aria-label={`${label} options`}
              aria-multiselectable={mode === "multiple" || undefined}
              className="min-h-0 max-h-52 overflow-y-auto overscroll-contain p-1"
            >
              {matches.map((option, index) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  size="content"
                  id={`${id}-option-${index}`}
                  data-option-index={index}
                  data-slot="filter-option"
                  role="option"
                  aria-selected={selected.has(option.value)}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option)}
                  onPointerMove={() => setActive(index)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-accent",
                    active === index && "bg-accent text-accent-foreground",
                  )}
                >
                  <span aria-hidden>
                    <OptionIcon option={option} />
                  </span>
                  <span className="min-w-0 flex-1 break-words">
                    {option.label}
                  </span>
                  {selected.has(option.value) && (
                    <Check
                      aria-hidden
                      className="size-4 shrink-0 text-primary"
                    />
                  )}
                </Button>
              ))}
            </div>
            {!matches.length && (
              <p
                role="status"
                className="px-3 py-3 text-xs text-muted-foreground"
              >
                No matching options
              </p>
            )}
          </div>
        )}
      </div>
      <span id={`${id}-selection`} className="sr-only" aria-live="polite">
        {value.length
          ? `${value.length} selected: ${selectedLabels.join(", ")}`
          : emptyLabel}
      </span>
    </div>
  );
}
