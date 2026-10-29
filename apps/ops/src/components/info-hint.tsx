"use client";

import { Button } from "@orbs/ui/controls/button";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orbs/ui/controls/tooltip";

/** Keeps definitions one hover away so screens show data, not explanations. */
export function InfoHint({
  children,
  label = "About this section",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="content"
          type="button"
          aria-label={label}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info aria-hidden className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
