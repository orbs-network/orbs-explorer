"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
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

export function FilterCombobox({
  label,
  options,
  value,
  onChange,
  mode = "single",
  placeholder,
}: {
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  mode?: "single" | "multiple";
  placeholder?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState<"above" | "below">("below");
  const selected = useMemo(() => new Set(value), [value]);
  const selectedLabels = value.map(
    (item) => options.find((option) => option.value === item)?.label ?? item,
  );
  const selectedLogos = open
    ? []
    : value
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
      : (selectedLabels[0] ?? "");
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
    const input = inputRef.current;
    if (input) {
      const rect = input.getBoundingClientRect();
      const scroller = input
        .closest("[data-filter-scroll]")
        ?.getBoundingClientRect();
      const bottom = Math.min(
        window.innerHeight,
        scroller?.bottom ?? window.innerHeight,
      );
      setPlacement(
        bottom - rect.bottom < 220 && rect.top - (scroller?.top ?? 0) > 220
          ? "above"
          : "below",
      );
    }
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setSearch("");
    setActive(-1);
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
    if (mode === "single") close();
  };

  useEffect(() => {
    if (open && active >= 0)
      listRef.current
        ?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <div className="min-w-0 space-y-1.5" data-vaul-no-drag>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        {selectedLogos.length ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 -space-x-1"
          >
            {selectedLogos.map((option) =>
              option.chainId !== undefined ? (
                <NetworkIcon
                  key={option.value}
                  chainId={option.chainId}
                  name={option.label}
                  className="border-background"
                />
              ) : (
                <Avatar
                  key={option.value}
                  className="size-4 border border-background bg-background"
                >
                  <AvatarImage src={option.logo} alt="" />
                  <AvatarFallback className="text-[8px]">
                    {option.label.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ),
            )}
          </span>
        ) : (
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <Input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && active >= 0 && matches[active]
              ? `${id}-option-${active}`
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={open ? search : summary}
          placeholder={
            open
              ? placeholder || `Search ${label.toLowerCase()}…`
              : `Any ${label.toLowerCase()}…`
          }
          className={cn(
            "h-10 pl-9 pr-16 placeholder:text-muted-foreground",
            selectedLogos.length > 1 && "pl-16",
          )}
          onFocus={() => {
            showOptions();
            setActive(-1);
          }}
          onClick={() => {
            if (!open) showOptions();
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            showOptions();
            setActive(0);
          }}
          onBlur={close}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              showOptions();
              setActive((index) =>
                event.key === "ArrowDown"
                  ? Math.min(index + 1, matches.length - 1)
                  : index < 0
                    ? matches.length - 1
                    : Math.max(0, index - 1),
              );
            } else if (open && (event.key === "Home" || event.key === "End")) {
              event.preventDefault();
              setActive(event.key === "Home" ? 0 : matches.length - 1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const exact = matches.find(
                (option) =>
                  option.label.toLowerCase() === search.trim().toLowerCase() ||
                  option.value.toLowerCase() === search.trim().toLowerCase(),
              );
              const option = matches[active] || exact;
              if (open && option) select(option);
              else showOptions();
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
          {value.length > 0 && (
            <button
              type="button"
              aria-label={`Clear ${label.toLowerCase()}`}
              title={`Clear ${label.toLowerCase()}`}
              className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange([]);
                setSearch("");
                setActive(-1);
              }}
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label={`Show ${label.toLowerCase()} options`}
            tabIndex={-1}
            className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (open) close();
              else {
                inputRef.current?.focus();
                showOptions();
              }
            }}
          >
            <ChevronDown aria-hidden className="size-3.5" />
          </button>
        </div>
        {open && (
          <div
            ref={listRef}
            id={`${id}-options`}
            role="listbox"
            aria-label={`${label} options`}
            aria-multiselectable={mode === "multiple" || undefined}
            className={cn(
              "absolute z-[60] max-h-52 w-full overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg",
              placement === "above" ? "bottom-full mb-1" : "top-full mt-1",
            )}
          >
            {matches.length ? (
              matches.map((option, index) => (
                <button
                  key={option.value}
                  id={`${id}-option-${index}`}
                  data-option-index={index}
                  type="button"
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
                  {option.chainId !== undefined ? (
                    <span aria-hidden>
                      <NetworkIcon
                        chainId={option.chainId}
                        name={option.label}
                      />
                    </span>
                  ) : option.logo ? (
                    <Avatar aria-hidden className="size-4 shrink-0">
                      <AvatarImage src={option.logo} alt="" />
                      <AvatarFallback>{option.label.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ) : null}
                  <span className="min-w-0 flex-1 break-words">
                    {option.label}
                  </span>
                  {selected.has(option.value) && (
                    <Check
                      aria-hidden
                      className="size-4 shrink-0 text-primary"
                    />
                  )}
                </button>
              ))
            ) : (
              <div
                role="status"
                className="px-2.5 py-3 text-sm text-muted-foreground"
              >
                No matching options
              </div>
            )}
          </div>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {value.length
          ? `${value.length} selected: ${selectedLabels.join(", ")}`
          : "No selection"}
      </span>
    </div>
  );
}
