import { useCopy } from "@/lib/hooks/use-copy";
import { CopyIcon } from "lucide-react";
import React from "react";
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
    <div className="flex flex-row gap-2 items-center">
      {tooltip ? (
        <>
          <Tooltip>
            <TooltipTrigger>
              <p className="text-sm font-mono">{text}</p>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tooltip}</TooltipContent>
          </Tooltip>

        </>
      ) : (
        <p className="text-sm font-mono">{text}</p>
      )}
      <CopyIcon
        className="w-4 h-4 cursor-pointer"
        onClick={() => copy(value)}
      />
    </div>
  );
}
