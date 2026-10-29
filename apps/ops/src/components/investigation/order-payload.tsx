"use client";

import { Braces } from "lucide-react";
import type { Order } from "@orbs/domain/twap/types";
import { Button } from "@orbs/ui/controls/button";
import { JsonPreviewDialog } from "@orbs/ui/json-preview-dialog";

export function OrderPayload({
  full,
  defaultOpen = false,
}: {
  full: Order;
  defaultOpen?: boolean;
}) {
  return (
    <JsonPreviewDialog
      data={full}
      title="Raw order service data"
      description="Original order and execution fields returned by the service."
      defaultOpen={defaultOpen}
    >
      <Button variant="secondary" size="sm">
        <Braces aria-hidden className="size-3.5" />
        View order JSON
      </Button>
    </JsonPreviewDialog>
  );
}
