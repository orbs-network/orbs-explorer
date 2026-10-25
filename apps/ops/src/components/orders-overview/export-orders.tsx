"use client";

import type { ListOrder } from "@orbs/domain/twap/types";
import { Button } from "@orbs/ui/controls/button";
import { ChevronDown, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@orbs/ui/controls/dropdown-menu";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";

function download(content: string, type: string, extension: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ops-orders-${new Date().toISOString().slice(0, 10)}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  // Keep spreadsheet applications from interpreting service messages as formulas.
  return `"${(/^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};

export function ExportOrders({
  orders,
  context,
}: {
  orders: ListOrder[];
  context?: string;
}) {
  const countLabel = `${orders.length.toLocaleString()}${context ? ` ${context}` : ""} ${orders.length === 1 ? "order" : "orders"}`;
  const csv = () => {
    const fields = [
      "hash",
      "source",
      "chain_id",
      "adapter",
      "placed_at",
      "deadline_unix",
      "input_token",
      "output_token",
      "placed_usd",
      "type",
      "status",
      "display_status",
      "description",
      "status_description",
      "planned_chunks",
      "successful_chunks",
      "error_chunks",
      "total_chunks",
      "last_chunk_status",
      "last_chunk_description",
      "last_chunk_due",
      "price_check_percentage",
    ];
    const rows = orders.map((order) => {
      const m = order.metadata;
      const c = m.chunkSummary;
      return [
        order.hash,
        order.source,
        getTwapOrderChainId(order),
        order.exchangeAdapter,
        order.timestamp,
        order.order.witness.deadline,
        order.inputToken,
        order.outputToken,
        order.totalUSDAmount,
        m.orderType,
        m.status,
        m.displayOnlyStatus,
        m.description,
        m.displayOnlyStatusDescription,
        m.expectedChunks,
        c?.success,
        c?.error,
        c?.total,
        c?.lastChunkStatus,
        c?.lastChunkDescription,
        c?.lastChunkDueTime,
        m.displayOnlyPriceCheckPercentage,
      ];
    });
    download(
      [fields, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
      "csv",
    );
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={context ? "gap-1" : undefined}
          disabled={!orders.length}
          aria-label={context ? `Export ${countLabel}` : "Export orders"}
        >
          <Download
            aria-hidden
            className={context ? "hidden size-3.5 sm:block" : "size-3.5"}
          />
          {context ? (
            <>
              <span className="hidden sm:inline">Export {countLabel}</span>
              <span className="sm:hidden">
                Export ({orders.length.toLocaleString()})
              </span>
            </>
          ) : (
            "Export"
          )}
          <ChevronDown aria-hidden className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{countLabel} in this export</DropdownMenuLabel>
        <DropdownMenuItem onSelect={csv}>
          {context ? `${countLabel}, CSV` : "Download CSV"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            download(
              JSON.stringify(orders, null, 2),
              "application/json",
              "json",
            )
          }
        >
          {context ? `${countLabel}, JSON` : "Download JSON"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
