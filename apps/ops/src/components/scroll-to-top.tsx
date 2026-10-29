"use client";

import { useSyncExternalStore } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

const isScrolled = () => window.scrollY > 0;
const serverSnapshot = () => false;

export function ScrollToTop() {
  const visible = useSyncExternalStore(subscribe, isScrolled, serverSnapshot);

  if (!visible) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          aria-label="Back to top"
          className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-11 rounded-full shadow-lg"
          onClick={() => {
            document
              .getElementById("main-content")
              ?.focus({ preventScroll: true });
            // Measurements during a long virtualized jump can interrupt smooth scrolling.
            window.scrollTo({
              top: 0,
              behavior:
                window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
                window.scrollY > window.innerHeight * 2
                  ? "instant"
                  : "smooth",
            });
          }}
        >
          <ArrowUp aria-hidden className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        Back to top
      </TooltipContent>
    </Tooltip>
  );
}
