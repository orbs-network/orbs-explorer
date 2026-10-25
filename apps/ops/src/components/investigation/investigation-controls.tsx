"use client";

import { useId, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";

export const InvestigationSelectItem = SelectItem;

export function InvestigationSelect({
  label,
  value,
  onChange,
  children,
  required,
  placeholder,
  compact = false,
  hideLabel = compact,
}: {
  label: string;
  /** Toolbar size with the label kept for screen readers only. */
  compact?: boolean;
  /** Label for screen readers only, for selects that sit beside a search field. */
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div
      className={hideLabel ? "min-w-0" : "min-w-0 space-y-1.5"}
      data-vaul-no-drag
    >
      <label
        htmlFor={id}
        className={
          hideLabel
            ? "sr-only"
            : "block text-xs font-medium text-muted-foreground"
        }
      >
        {label}
      </label>
      <Select
        name={label.toLowerCase().replaceAll(" ", "_")}
        autoComplete="off"
        value={value}
        onValueChange={onChange}
        required={required}
      >
        <SelectTrigger
          id={id}
          className={`min-w-0 border-control-border bg-control-background text-foreground ${compact ? "h-8 text-xs" : "h-10"}`}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
