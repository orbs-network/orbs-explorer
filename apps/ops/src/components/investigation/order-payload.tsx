"use client";

import { useMemo } from "react";
import type { Order } from "@orbs/domain/twap/types";
import { Copy } from "@orbs/ui/controls/copy";

export function OrderPayload({ full }: { full: Order }) {
  const payload = useMemo(() => JSON.stringify(full, null, 2), [full]);
  return (
    <div className="mt-2">
      <Copy text="Copy full order JSON" value={payload} />
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px]">
        {payload}
      </pre>
    </div>
  );
}
