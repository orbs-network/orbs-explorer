"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@orbs/ui/controls/dialog";
import { OrderLookup } from "./order-lookup";
import { useOrderNavigationScope } from "@/hooks/use-order-navigation-scope";

export function QuickOrderSearch() {
  const navigationScope = useOrderNavigationScope();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.isComposing &&
        event.key.toLowerCase() === "k"
      ) {
        // Let an existing dialog keep keyboard focus.
        if (
          !open &&
          document.querySelector('[role="dialog"][data-state="open"]')
        )
          return;
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Find order"
          aria-keyshortcuts="Meta+K Control+K"
          className="gap-1.5 px-2 text-xs"
        >
          <Search aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">Find order</span>
          <kbd className="ml-1 hidden rounded bg-muted px-1 font-sans text-[10px] text-muted-foreground lg:inline">
            ⌘ / Ctrl K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Find order</DialogTitle>
          <DialogDescription className="sr-only">
            Enter an order ID to open its details.
          </DialogDescription>
        </DialogHeader>
        <OrderLookup
          navigationScope={navigationScope}
          onNavigate={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
