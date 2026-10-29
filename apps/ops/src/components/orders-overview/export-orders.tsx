"use client";

import { useSearchParams } from "next/navigation";
import type { ListOrder, Order } from "@orbs/domain/twap/types";
import { Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
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
  snapshotAt,
}: {
  orders: ListOrder[];
  snapshotAt?: number;
}) {
  return (
    <OrdersExport
      orders={orders}
      records={orders}
      scope="All matching records, not just the visible page"
      snapshotAt={snapshotAt}
    />
  );
}

export function ExportOrder({
  order,
  summary,
  retrievedAt,
}: {
  order: Order;
  summary: ListOrder;
  retrievedAt: number;
}) {
  return (
    <OrdersExport
      orders={[summary]}
      records={[order]}
      scope="Selected order"
      snapshotAt={retrievedAt}
    />
  );
}

function OrdersExport({
  orders,
  records,
  scope,
  snapshotAt,
}: {
  orders: ListOrder[];
  records: ListOrder[] | Order[];
  scope: string;
  snapshotAt?: number;
}) {
  const search = useSearchParams();
  const snapshot = snapshotAt;
  const metadata = () => ({
    exported_utc: new Date().toISOString(),
    snapshot_utc: snapshot ? new Date(snapshot).toISOString() : "unavailable",
    timezone: "UTC",
    filter_query: search.toString(),
    scope,
    value_definition:
      "Original reported placed order value, not executed volume",
  });
  const csv = () => {
    const meta = metadata();
    const fields = [
      ...Object.keys(meta),
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
        ...Object.values(meta),
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
    <Select
      value=""
      disabled={!orders.length}
      onValueChange={(format) => {
        if (format === "csv") csv();
        else if (format === "json")
          download(
            JSON.stringify({ metadata: metadata(), orders: records }, null, 2),
            "application/json",
            "json",
          );
      }}
    >
      <SelectTrigger className="h-9 w-auto" aria-label="Export">
        <span className="inline-flex! items-center gap-2">
          <Download aria-hidden className="size-3.5 shrink-0" />
          <SelectValue placeholder="Export" />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="csv">Download CSV</SelectItem>
        <SelectItem value="json">Download JSON</SelectItem>
      </SelectContent>
    </Select>
  );
}
