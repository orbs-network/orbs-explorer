"use client";

import { Download } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@orbs/ui/controls/dropdown-menu";
import {
  placementComparisonCsv,
  placementComparisonExport,
} from "@/lib/placement-report-export";
import type {
  TradingAppGrouping,
  TradingAppRow,
} from "@/lib/trading-apps-table";

export function ExportComparison({
  rows,
  query,
  snapshot,
  grouping,
  search,
}: {
  rows: TradingAppRow[];
  query: string;
  snapshot: number;
  grouping: TradingAppGrouping;
  search: string;
}) {
  function download(format: "csv" | "json") {
    const report = placementComparisonExport({
      rows,
      query,
      snapshot,
      grouping,
      search,
      exportedAt: Date.now(),
    });
    const content =
      format === "csv"
        ? placementComparisonCsv(report)
        : JSON.stringify(report, null, 2);
    const url = URL.createObjectURL(
      new Blob([content], {
        type: format === "csv" ? "text/csv;charset=utf-8" : "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ops-app-comparison-${new Date(snapshot).toISOString().slice(0, 10)}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!rows.length}
          className="h-9 text-xs"
          aria-label="Export trading apps"
        >
          <Download aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">Export trading apps</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="w-72 max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuLabel className="whitespace-normal text-xs leading-relaxed">
          {rows.length} matching trading apps · all rows, scope & definitions
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => download("csv")}>
          Comparison CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => download("json")}>
          Comparison JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
