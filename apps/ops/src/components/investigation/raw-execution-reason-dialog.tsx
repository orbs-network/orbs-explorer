"use client";

import { Copy, FileText } from "lucide-react";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { Button } from "@orbs/ui/controls/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@orbs/ui/controls/dialog";

export function RawExecutionReasonDialog({
  reason,
  chunkIndex,
}: {
  reason: string;
  chunkIndex: number;
}) {
  const copy = useCopy();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground [@media(pointer:coarse)]:min-h-11"
          aria-label={`Chunk ${chunkIndex} full raw execution reason`}
        >
          <FileText aria-hidden className="size-3.5" />
          Raw reason
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(40rem,calc(100dvh-2rem))] min-h-0 flex-col overflow-hidden border-0 sm:max-w-4xl [&_[data-slot=dialog-close]]:top-2 [&_[data-slot=dialog-close]]:right-2 [&_[data-slot=dialog-close]]:grid [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:place-items-center">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>Chunk {chunkIndex} execution reason</DialogTitle>
          <DialogDescription>
            Full original error text reported by the execution service.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-start">
          <Button variant="secondary" size="sm" onClick={() => copy(reason)}>
            <Copy aria-hidden className="size-3.5" />
            Copy reason
          </Button>
        </div>
        <pre
          role="region"
          aria-label="Full raw execution reason"
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
        >
          {reason}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
