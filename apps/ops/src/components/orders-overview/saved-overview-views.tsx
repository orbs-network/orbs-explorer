"use client";

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Check,
  ChevronDown,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@orbs/ui/controls/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@orbs/ui/controls/dialog";
import {
  MAX_OVERVIEW_VIEW_NAME_LENGTH,
  MAX_SAVED_OVERVIEW_VIEWS,
  OVERVIEW_VIEWS_STORAGE_KEY,
  canonicalOverviewQuery,
  overviewViewHref,
  overviewViewName,
  parseSavedOverviewViews,
  serializeSavedOverviewViews,
  type SavedOverviewView,
} from "@/lib/overview-views";

const STORAGE_UNAVAILABLE = "storage-unavailable";
const STORAGE_EVENT = "orbs-ops-saved-filter-views";
function readStorage() {
  try {
    return localStorage.getItem(OVERVIEW_VIEWS_STORAGE_KEY) ?? "";
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === OVERVIEW_VIEWS_STORAGE_KEY || event.key === null)
      onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}
const serverSnapshot = () => "";

export function SavedOverviewViews() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = useSyncExternalStore(subscribe, readStorage, serverSnapshot);
  const views = useMemo(() => parseSavedOverviewViews(raw), [raw]);
  const currentQuery = canonicalOverviewQuery(searchParams?.toString() ?? "");
  const available = raw !== STORAGE_UNAVAILABLE;
  const [dialog, setDialog] = useState<"save" | "manage">("save");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const manageTitle = useRef<HTMLHeadingElement>(null);

  function persist(next: SavedOverviewView[]) {
    try {
      localStorage.setItem(
        OVERVIEW_VIEWS_STORAGE_KEY,
        serializeSavedOverviewViews(next),
      );
      window.dispatchEvent(new Event(STORAGE_EVENT));
      return true;
    } catch {
      toast.error("This browser could not save your filter views.");
      return false;
    }
  }

  function apply(view: SavedOverviewView) {
    setDialogOpen(false);
    router.push(overviewViewHref(view.query), { scroll: false });
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validName = overviewViewName(name);
    const message = !validName
      ? "Enter a name of 1–60 characters."
      : views.some(
            (view) => view.name.toLowerCase() === validName.toLowerCase(),
          )
        ? "A saved view already uses this name."
        : views.length >= MAX_SAVED_OVERVIEW_VIEWS
          ? "Remove a saved view before adding another."
          : "";
    if (message) {
      setError(message);
      toast.error(message);
      nameInput.current?.focus();
      return;
    }
    if (
      persist([
        ...views,
        {
          id: crypto.randomUUID(),
          name: validName!,
          query: currentQuery,
          createdAt: Date.now(),
        },
      ])
    ) {
      setDialogOpen(false);
      toast.success(`Saved “${validName}” in this browser.`);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={trigger}
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
          >
            <Bookmark aria-hidden className="size-3.5" />
            Saved filter views
            <ChevronDown aria-hidden className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 max-w-[calc(100vw-1.5rem)]"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Saved in this browser
          </DropdownMenuLabel>
          {!available ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              Browser storage is unavailable.
            </p>
          ) : views.length ? (
            views.map((view) => (
              <DropdownMenuItem key={view.id} onSelect={() => apply(view)}>
                <span className="min-w-0 flex-1 truncate" title={view.name}>
                  {view.name}
                </span>
                {view.query === currentQuery && (
                  <Check aria-hidden className="size-3.5" />
                )}
              </DropdownMenuItem>
            ))
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              No saved filter views.
            </p>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!available || views.length >= MAX_SAVED_OVERVIEW_VIEWS}
            onSelect={() => {
              setName("");
              setError("");
              setDialog("save");
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden />
            Save current view…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!views.length}
            onSelect={() => {
              setDialog("manage");
              setDialogOpen(true);
            }}
          >
            <Settings2 aria-hidden />
            Manage saved views…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader className="pr-6 text-left">
            <DialogTitle ref={manageTitle} tabIndex={-1}>
              {dialog === "save"
                ? "Save filter view"
                : "Manage saved filter views"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "save"
                ? "Save the period, networks, trading apps, zero-order app visibility, and overview tab in this browser. You can share the page URL; saved names and personal review rules remain local to this browser."
                : `Saved in this browser. You can keep up to ${MAX_SAVED_OVERVIEW_VIEWS} filter views.`}
            </DialogDescription>
          </DialogHeader>
          {dialog === "save" ? (
            <form onSubmit={save} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor={id} className="text-sm font-medium">
                  View name
                </label>
                <Input
                  ref={nameInput}
                  id={id}
                  autoComplete="off"
                  maxLength={MAX_OVERVIEW_VIEW_NAME_LENGTH}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError("");
                  }}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${id}-error` : undefined}
                  placeholder="e.g. Polygon · 30 days"
                />
                {error && (
                  <p
                    id={`${id}-error`}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save view</Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              {views.length ? (
                <ul className="space-y-1">
                  {views.map((view) => (
                    <li
                      key={view.id}
                      className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 p-1"
                    >
                      <Button
                        variant="ghost"
                        className="min-w-0 flex-1 justify-start"
                        onClick={() => apply(view)}
                        aria-label={`Apply ${view.name}`}
                      >
                        <span className="truncate">{view.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${view.name}`}
                        onClick={() => {
                          if (
                            persist(views.filter((item) => item.id !== view.id))
                          ) {
                            manageTitle.current?.focus();
                            toast.success(`Removed “${view.name}”.`);
                          }
                        }}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  No saved filter views.
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
