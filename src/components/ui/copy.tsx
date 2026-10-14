"use client";

import { useCopy } from "@/lib/hooks/use-copy";
import { CopyIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function Copy({
  text,
  value,
  tooltip,
}: {
  text: string;
  value: string;
  tooltip?: string;
}) {
  const copy = useCopy();
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger className="min-w-0 text-sm font-mono">
            {text}
          </TooltipTrigger>
          <TooltipContent side="bottom">{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="min-w-0 break-all text-sm font-mono">{text}</span>
      )}
      <button
        type="button"
        onClick={() => copy(value)}
        aria-label="Copy value"
        title="Copy value"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <CopyIcon aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}
