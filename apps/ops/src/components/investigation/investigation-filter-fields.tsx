"use client";

import { useId, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { OVERVIEW_STATUSES } from "@orbs/domain/twap/utils/orders-overview";
import { Input } from "@orbs/ui/controls/input";
import type { FilterBadge, FilterValidation } from "@orbs/ui/filter-drawer";
import {
  getUsdRangeError,
  getSwapperAddressError,
  type InvestigationFilters,
} from "@/lib/order-investigation";
import {
  matchingOrderQuickView,
  orderQuickViewFilters,
  ORDER_QUICK_VIEWS,
  type OrderQuickView,
} from "@/lib/order-quick-views";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "./investigation-controls";

const errors = {
  all: "Any error history",
  any: "Has execution errors",
  latest: "Latest attempt failed",
  recovered: "Completed after errors",
  none: "Zero reported errors",
  unreported: "Error count not provided",
};
const deadlines = {
  all: "Any deadline",
  past: "Active past deadline",
  soon: "Active · deadline within 1 hour",
  unreported: "Active · deadline unreported",
};

export function investigationBadges(
  value: InvestigationFilters,
  onChange: (value: InvestigationFilters) => void,
): FilterBadge[] {
  const badges: FilterBadge[] = [];
  const add = (key: keyof InvestigationFilters, label: string, reset: string) =>
    badges.push({
      key: `order-${key}`,
      category: key === "minUsd" || key === "maxUsd" ? "placed-value" : key,
      label,
      onRemove: () => onChange({ ...value, [key]: reset }),
    });
  if (value.query) add("query", `Search: ${value.query}`, "");
  if (value.adapter) add("adapter", `Adapter: ${value.adapter}`, "");
  if (value.token) add("token", `Token: ${value.token}`, "");
  if (value.swapper) add("swapper", `Swapper: ${value.swapper}`, "");
  if (value.status !== "all")
    add("status", `Status: ${OVERVIEW_STATUSES[value.status].label}`, "all");
  if (value.type !== "all")
    add(
      "type",
      `Type: ${value.type === "unreported" ? "Not provided" : value.type}`,
      "all",
    );
  if (value.source !== "all") add("source", "Service filter", "all");
  if (value.errors !== "all")
    add("errors", `Errors: ${errors[value.errors]}`, "all");
  if (value.activeAge === "24h") add("activeAge", "Active age: 24h+", "all");
  if (value.review === "attention")
    add("review", "Active orders needing review", "all");
  if (value.deadline !== "all")
    add("deadline", deadlines[value.deadline], "all");
  if (value.placedSince || value.placedUntil)
    badges.push({
      key: "order-placement-range",
      label: `Placed: ${value.placedSince || "any start"} → ${value.placedUntil || "any end"}`,
      onRemove: () => onChange({ ...value, placedSince: "", placedUntil: "" }),
    });
  if (value.minUsd) add("minUsd", `Minimum USD: ${value.minUsd}`, "");
  if (value.maxUsd) add("maxUsd", `Maximum USD: ${value.maxUsd}`, "");
  return badges;
}

export function InvestigationFilterFields({
  value,
  onChange,
  types,
  validation,
  children,
}: {
  value: InvestigationFilters;
  onChange: (value: InvestigationFilters) => void;
  types: string[];
  validation: FilterValidation;
  children?: ReactNode;
}) {
  const id = useId();
  const quickView = matchingOrderQuickView(value);
  const minError = getUsdRangeError(value.minUsd, "");
  const swapperError = getSwapperAddressError(value.swapper);
  const maxError = getUsdRangeError("", value.maxUsd);
  const rangeError =
    !minError && !maxError && getUsdRangeError(value.minUsd, value.maxUsd);
  const update = <Key extends keyof InvestigationFilters>(
    key: Key,
    next: InvestigationFilters[Key],
  ) => onChange({ ...value, [key]: next });
  const advancedFiltersCount = [
    value.errors !== "all",
    value.activeAge !== "all",
    value.deadline !== "all",
    Boolean(value.adapter),
    Boolean(value.token),
    Boolean(value.swapper),
    Boolean(value.minUsd || value.maxUsd),
  ].filter(Boolean).length;
  const [advancedOpen, setAdvancedOpen] = useState(advancedFiltersCount > 0);
  return (
    <div className="space-y-4">
      <InvestigationSelect
        label="Presets"
        value={quickView === "custom" || quickView === "all" ? "" : quickView}
        placeholder="Select preset"
        onChange={(next) =>
          onChange(orderQuickViewFilters(next as OrderQuickView))
        }
      >
        {ORDER_QUICK_VIEWS.map((view) => (
          <InvestigationSelectItem key={view.value} value={view.value}>
            {view.label}
          </InvestigationSelectItem>
        ))}
      </InvestigationSelect>
      <InvestigationSelect
        label="Status"
        value={value.status}
        onChange={(next) =>
          update("status", next as InvestigationFilters["status"])
        }
      >
        <InvestigationSelectItem value="all">
          All statuses
        </InvestigationSelectItem>
        {Object.entries(OVERVIEW_STATUSES).map(([key, status]) => (
          <InvestigationSelectItem key={key} value={key}>
            {status.label}
          </InvestigationSelectItem>
        ))}
      </InvestigationSelect>
      {children}
      <InvestigationSelect
        label="Order type"
        value={value.type}
        onChange={(next) => update("type", next)}
      >
        <InvestigationSelectItem value="all">All types</InvestigationSelectItem>
        {[
          ...new Set([...types, ...(value.type !== "all" ? [value.type] : [])]),
        ].map((type) => (
          <InvestigationSelectItem key={type} value={type}>
            {type === "unreported" ? "Type not provided" : type}
          </InvestigationSelectItem>
        ))}
      </InvestigationSelect>
      <div className="space-y-1.5">
        <label
          htmlFor={`${id}-search`}
          className="block text-xs font-medium text-muted-foreground"
        >
          Search orders
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={`${id}-search`}
            name="order_search"
            type="search"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={value.query}
            onChange={(event) => update("query", event.target.value)}
            placeholder="Order ID, app, token, address, or error…"
            className="pl-9 text-sm"
          />
        </div>
      </div>
      <details
        className="border-t border-border pt-3"
        open={advancedOpen || Boolean(validation.error)}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer rounded text-xs font-medium hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Advanced filters
          {advancedFiltersCount > 0 ? ` (${advancedFiltersCount})` : ""}
        </summary>
        <div className="mt-4 space-y-4">
          <InvestigationSelect
            label="Execution error history"
            value={value.errors}
            onChange={(next) =>
              update("errors", next as InvestigationFilters["errors"])
            }
          >
            {Object.entries(errors).map(([key, label]) => (
              <InvestigationSelectItem key={key} value={key}>
                {label}
              </InvestigationSelectItem>
            ))}
          </InvestigationSelect>
          <InvestigationSelect
            label="Active order age"
            value={value.activeAge}
            onChange={(next) =>
              onChange({
                ...value,
                activeAge: next as InvestigationFilters["activeAge"],
                status: next === "24h" ? "active" : value.status,
              })
            }
          >
            <InvestigationSelectItem value="all">
              Any active age
            </InvestigationSelectItem>
            <InvestigationSelectItem value="24h">
              At least 24 hours
            </InvestigationSelectItem>
          </InvestigationSelect>
          <InvestigationSelect
            label="Active order deadline"
            value={value.deadline}
            onChange={(next) =>
              onChange({
                ...value,
                deadline: next as InvestigationFilters["deadline"],
                status: next === "all" ? value.status : "active",
              })
            }
          >
            {Object.entries(deadlines).map(([key, label]) => (
              <InvestigationSelectItem key={key} value={key}>
                {label}
              </InvestigationSelectItem>
            ))}
          </InvestigationSelect>

          {(["swapper", "adapter", "token"] as const).map((key) => (
            <div key={key} className="min-w-0 space-y-1.5">
              <label
                htmlFor={`${id}-${key}`}
                className="block text-xs font-medium text-muted-foreground"
              >
                {key === "swapper"
                  ? "Swapper address (exact)"
                  : key === "adapter"
                    ? "Adapter address (exact)"
                    : "Token address (either side, exact)"}
              </label>
              <Input
                id={`${id}-${key}`}
                name={`order_${key}`}
                value={value[key]}
                onChange={(event) => update(key, event.target.value)}
                placeholder="Any address…"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(
                  key === "swapper" && validation.error && swapperError,
                )}
                aria-describedby={
                  key === "swapper" && validation.error && swapperError
                    ? validation.errorId
                    : undefined
                }
                className="font-mono text-xs"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {(["minUsd", "maxUsd"] as const).map((key) => (
              <div key={key} className="min-w-0 space-y-1.5">
                <label
                  htmlFor={`${id}-${key}`}
                  className="block text-xs text-muted-foreground"
                >
                  {key === "minUsd" ? "Minimum" : "Maximum"} placed USD
                </label>
                <Input
                  id={`${id}-${key}`}
                  name={key === "minUsd" ? "min_usd" : "max_usd"}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={key === "minUsd" ? "No minimum…" : "No maximum…"}
                  value={value[key]}
                  onChange={(event) => update(key, event.target.value)}
                  aria-invalid={Boolean(
                    validation.error &&
                    ((key === "minUsd" ? minError : maxError) || rangeError),
                  )}
                  aria-describedby={
                    validation.error ? validation.errorId : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
