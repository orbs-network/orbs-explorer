"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./controls/button";
import { Badge } from "./controls/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./controls/drawer";

export type FilterBadge = {
  key: string;
  category?: string;
  label: string;
  icon?: ReactNode;
  onRemove?: () => void;
};

export type FilterValidation = {
  error?: string;
  errorId: string;
};

export type FilterApplicationMode = "draft" | "immediate";

export function FilterDrawer<Value extends object>({
  label = "Filters",
  description,
  value,
  clearValue,
  onApply,
  badges,
  children,
  validate,
  emptyLabel = "No filters applied",
  toolbarControls,
  applicationMode = "draft",
}: {
  label?: string;
  description: string;
  value: Value;
  clearValue: Value;
  onApply: (value: Value) => void;
  badges: FilterBadge[];
  children: (
    value: Value,
    onChange: (value: Value) => void,
    validation: FilterValidation,
  ) => ReactNode;
  validate?: (value: Value) => string | undefined;
  emptyLabel?: string;
  toolbarControls?: ReactNode;
  applicationMode?: FilterApplicationMode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const validationMessage = useRef<HTMLParagraphElement>(null);
  const errorId = useId();
  const errorToastId = `filter-validation-${errorId}`;
  const count = new Set(
    badges
      .filter((badge) => badge.onRemove)
      .map((badge) => badge.category ?? badge.key),
  ).size;
  const immediate = applicationMode === "immediate";
  const clearValidation = () => {
    setError(undefined);
    toast.dismiss(errorToastId);
  };
  const updateDraft = (next: Value) => {
    setDraft(next);
    if (immediate) {
      const nextError = validate?.(next);
      if (nextError) {
        setError(nextError);
        if (nextError !== error) toast.error(nextError, { id: errorToastId });
        return;
      }
    }
    clearValidation();
    if (immediate) onApply(next);
  };
  return (
    <section aria-label={`${label} toolbar`} className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {toolbarControls}
        <Drawer
          direction="right"
          open={open}
          onOpenChange={(next) => {
            if (next) setDraft(value);
            clearValidation();
            setOpen(next);
          }}
        >
          <DrawerTrigger asChild>
            <Button
              ref={trigger}
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${label}${count ? ` (${count} active)` : ""}`}
            >
              <SlidersHorizontal aria-hidden className="size-3.5" />
              {label}
              {count > 0 && (
                <span
                  aria-hidden
                  className="rounded bg-primary/15 px-1.5 text-[10px] tabular-nums"
                >
                  {count}
                </span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent
            onEscapeKeyDown={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                ((target.getAttribute("role") === "combobox" &&
                  target.getAttribute("aria-expanded") === "true") ||
                  target.closest('[data-slot="filter-options"]'))
              )
                event.preventDefault();
            }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              title.current?.focus();
            }}
            className="h-dvh min-h-0 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-md motion-reduce:transition-none"
          >
            <form
              ref={form}
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                const nextError = validate?.(draft);
                if (nextError) {
                  flushSync(() => setError(nextError));
                  toast.error(nextError, { id: errorToastId });
                  const invalidField = form.current?.querySelector<HTMLElement>(
                    '[aria-invalid="true"]',
                  );
                  (invalidField ?? validationMessage.current)?.focus();
                  validationMessage.current?.scrollIntoView({
                    block: "nearest",
                  });
                  return;
                }
                clearValidation();
                if (!immediate) onApply(draft);
                setOpen(false);
              }}
            >
              <DrawerHeader className="shrink-0 border-b border-border p-5 pr-14 text-left">
                <DrawerTitle
                  ref={title}
                  tabIndex={-1}
                  className="focus:outline-none"
                >
                  {label}
                </DrawerTitle>
                <DrawerDescription className="text-xs leading-relaxed">
                  {description}
                </DrawerDescription>
              </DrawerHeader>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Close ${label.toLowerCase()}`}
                  className="absolute right-3 top-3"
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </DrawerClose>
              <div
                data-filter-scroll
                data-vaul-no-drag
                className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5"
              >
                {children(draft, updateDraft, { error, errorId })}
                {error && (
                  <p
                    ref={validationMessage}
                    id={errorId}
                    tabIndex={-1}
                    role="alert"
                    className="text-xs text-red-700 focus:outline-none dark:text-red-400"
                  >
                    {error}
                  </p>
                )}
              </div>
              <DrawerFooter className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => updateDraft(clearValue)}
                  >
                    Clear filters
                  </Button>
                  <div className="ml-auto flex gap-2">
                    {!immediate && (
                      <DrawerClose asChild>
                        <Button type="button" variant="outline" size="sm">
                          Cancel
                        </Button>
                      </DrawerClose>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      aria-describedby={error ? errorId : undefined}
                    >
                      {immediate ? "Done" : "Apply filters"}
                    </Button>
                  </div>
                </div>
              </DrawerFooter>
            </form>
          </DrawerContent>
        </Drawer>
        {badges.length ? (
          <div
            role="list"
            aria-label="Applied filters"
            className="order-2 flex w-full min-w-0 flex-none flex-wrap items-center gap-1.5 sm:order-none sm:w-auto sm:flex-1"
          >
            {badges.map((badge) => (
              <Badge
                key={badge.key}
                variant="outline"
                role="listitem"
                className="max-w-full gap-1 bg-card py-1 pl-2 pr-1 whitespace-normal"
              >
                {badge.icon && (
                  <span aria-hidden className="shrink-0">
                    {badge.icon}
                  </span>
                )}
                <span className="min-w-0 break-words text-[11px]">
                  {badge.label}
                </span>
                {badge.onRemove && (
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    aria-label={`Remove ${badge.label}`}
                    onClick={() => {
                      badge.onRemove?.();
                      trigger.current?.focus();
                    }}
                    className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden className="size-3" />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
        ) : emptyLabel ? (
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        ) : null}
        {count > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto sm:ml-0"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              onApply(clearValue);
              trigger.current?.focus();
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
    </section>
  );
}
