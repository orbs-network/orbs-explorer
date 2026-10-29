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

export function OrderReasonDialog({
  reason,
  source,
  field,
  reportedAt,
}: {
  reason: string;
  source: string;
  field?: string;
  reportedAt: string;
}) {
  const copy = useCopy();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-[13px] text-link"
        >
          <FileText aria-hidden className="size-3.5" />
          Full reason & source
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden border-0 sm:max-w-3xl [&_[data-slot=dialog-close]]:size-9">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Reported reason</DialogTitle>
          <DialogDescription>
            Original text and source reported by the order service.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          {[
            ["Source", source],
            ["Field", field || "Unreported"],
            ["Reported", reportedAt],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <pre
          tabIndex={0}
          role="region"
          aria-label="Full reported reason"
          className="min-h-24 min-w-0 overflow-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-4 font-mono text-xs leading-6 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {reason}
        </pre>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            A report timestamp does not establish an actual transaction
            execution time.
          </p>
          <Button variant="secondary" size="sm" onClick={() => copy(reason)}>
            <Copy aria-hidden className="size-3.5" />
            Copy reason
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
