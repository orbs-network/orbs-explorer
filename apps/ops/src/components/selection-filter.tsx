"use client";

import type { FilterOption } from "@orbs/ui/filter-combobox";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "./investigation/investigation-controls";

export function SelectionFilter({
  label,
  fieldLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  fieldLabel: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    // Inline label + select, matching the other scope controls above content.
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
    >
      <span aria-hidden className="text-xs font-medium">
        {fieldLabel}
      </span>
      <div className="w-56">
        <InvestigationSelect
          label={fieldLabel}
          compact
          value={value}
          onChange={onChange}
        >
          {options.map((option) => (
            <InvestigationSelectItem key={option.value} value={option.value}>
              {option.label}
            </InvestigationSelectItem>
          ))}
        </InvestigationSelect>
      </div>
    </div>
  );
}
