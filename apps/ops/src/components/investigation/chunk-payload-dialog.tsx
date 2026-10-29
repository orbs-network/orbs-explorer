"use client";

import { Braces } from "lucide-react";
import type { OrderChunk } from "@orbs/domain/twap/types";
import { Button } from "@orbs/ui/controls/button";
import { JsonPreviewDialog } from "@orbs/ui/json-preview-dialog";

export function ChunkPayloadDialog({ chunk }: { chunk: OrderChunk }) {
  return (
    <JsonPreviewDialog
      data={chunk}
      title={`Chunk ${chunk.index} service payload`}
      description="Original service fields for this execution chunk."
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground [@media(pointer:coarse)]:min-h-11"
        aria-label={`Chunk ${chunk.index} service payload`}
      >
        <Braces aria-hidden className="size-3.5" />
        Service payload
      </Button>
    </JsonPreviewDialog>
  );
}
