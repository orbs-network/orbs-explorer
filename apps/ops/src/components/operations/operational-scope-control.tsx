"use client";

import { useId } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
import type { OperationalPlacementScope } from "@/lib/operational-scope";
import { orderPeriodRange } from "@/lib/order-period";
import { InlineSkeleton } from "@/components/loading-skeletons";

export function OperationalScopeControl({
  placement,
  setPlacement,
  counts,
  period,
  isLoading = false,
  isUnavailable = false,
  hasAllDatesCount = true,
}: {
  placement: OperationalPlacementScope;
  setPlacement: (value: OperationalPlacementScope) => void;
  counts: { total: number; shown: number; excluded: number };
  period: string;
  isLoading?: boolean;
  isUnavailable?: boolean;
  hasAllDatesCount?: boolean;
}) {
  const id = useId();
  const range = orderPeriodRange(period);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-xs font-medium">
          Active order scope
        </label>
        <Select
          value={placement}
          onValueChange={(value) =>
            setPlacement(value as OperationalPlacementScope)
          }
        >
          <SelectTrigger id={id} className="h-8 w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All placement dates</SelectItem>
            <SelectItem value="placement">Selected placement period</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p
        role={isLoading && !isUnavailable ? undefined : "status"}
        className="max-w-2xl text-xs leading-relaxed text-muted-foreground"
      >
        {isUnavailable ? (
          "Current-order scope is unavailable until complete order history can be loaded."
        ) : isLoading ? (
          <InlineSkeleton
            label="Loading the current order snapshot"
            className="w-64"
          />
        ) : placement === "all" ? (
          `${counts.total.toLocaleString()} currently active · all placement dates`
        ) : (
          `${counts.shown.toLocaleString()} currently active · placed in ${range}.${hasAllDatesCount ? ` ${counts.excluded.toLocaleString()} older active orders excluded.` : ""}`
        )}
      </p>
    </div>
  );
}
