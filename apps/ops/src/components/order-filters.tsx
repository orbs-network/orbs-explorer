"use client";

import { useId } from "react";
import { FilterCombobox, type FilterOption } from "@orbs/ui/filter-combobox";
import {
  FilterDrawer,
  type FilterApplicationMode,
  type FilterBadge,
} from "@orbs/ui/filter-drawer";
import { NetworkIcon } from "@orbs/ui/controls/network";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
import {
  ORDER_PERIODS,
  type useOrderScope,
  type OrderScopeSelection,
} from "@/hooks/use-order-scope";
import { useInvestigationFilters } from "@/hooks/use-investigation-filters";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  getUsdRangeError,
  getPlacementRangeError,
  type InvestigationFilters,
} from "@/lib/order-investigation";
import { investigationFilterQuery } from "@/lib/investigation-filter-query";
import {
  InvestigationFilterFields,
  investigationBadges,
} from "./investigation/investigation-filter-fields";

type FilterValue = {
  scope: OrderScopeSelection;
  investigation: InvestigationFilters;
};

export function OrderFilters({
  scope,
  networkOptions,
  partnerOptions,
  partner,
  orderTypes,
  applicationMode = "draft",
  omitStatus = false,
  periodLabel = "Placed in",
}: {
  scope: ReturnType<typeof useOrderScope>;
  networkOptions: FilterOption[];
  partnerOptions: FilterOption[];
  partner?: { id: string; label: string };
  orderTypes?: string[];
  applicationMode?: FilterApplicationMode;
  omitStatus?: boolean;
  periodLabel?: string | null;
}) {
  const id = useId();
  const { filters } = useInvestigationFilters();
  const value: FilterValue = {
    scope: {
      period: scope.period,
      chainIds: scope.chainIds,
      partnerIds: partner ? [partner.id] : scope.partnerIds,
    },
    investigation: filters,
  };
  const apply = (next: FilterValue) =>
    scope.applyFilters(next.scope, {
      ...(orderTypes ? investigationFilterQuery(next.investigation) : {}),
    });
  const clearValue: FilterValue = {
    scope: {
      period: "7",
      chainIds: [],
      partnerIds: partner ? [partner.id] : [],
    },
    investigation: { ...DEFAULT_INVESTIGATION_FILTERS, sort: filters.sort },
  };
  const badges: FilterBadge[] = [];
  for (const chainId of scope.chainIds)
    badges.push({
      key: `chain-${chainId}`,
      icon: <NetworkIcon chainId={Number(chainId)} className="size-3.5" />,
      label: `Network: ${networkOptions.find((option) => option.value === chainId)?.label ?? chainId}`,
      onRemove: () =>
        apply({
          ...value,
          scope: {
            ...value.scope,
            chainIds: scope.chainIds.filter((id) => id !== chainId),
          },
        }),
    });
  if (!partner)
    for (const partnerId of scope.partnerIds)
      badges.push({
        key: `partner-${partnerId}`,
        label: `App: ${partnerOptions.find((option) => option.value === partnerId)?.label ?? partnerId}`,
        onRemove: () =>
          apply({
            ...value,
            scope: {
              ...value.scope,
              partnerIds: scope.partnerIds.filter((id) => id !== partnerId),
            },
          }),
      });
  if (orderTypes)
    badges.push(
      ...investigationBadges(filters, (next) =>
        apply({ ...value, investigation: next }),
      ),
    );
  return (
    <FilterDrawer
      value={value}
      clearValue={clearValue}
      onApply={apply}
      badges={badges}
      applicationMode={applicationMode}
      description={
        applicationMode === "immediate"
          ? "Changes apply immediately."
          : "Choose your filters, then select Apply filters."
      }
      emptyLabel={partner ? "All networks" : "All networks · all trading apps"}
      toolbarControls={
        periodLabel === null ? undefined : (
          <div className="flex shrink-0 items-center gap-2">
            <label
              htmlFor={`${id}-period`}
              className="text-xs text-muted-foreground"
            >
              {periodLabel}
            </label>
            <Select
              name="period"
              value={scope.period}
              onValueChange={(period) =>
                apply({ ...value, scope: { ...value.scope, period } })
              }
            >
              <SelectTrigger
                id={`${id}-period`}
                className="h-8 w-32 border-control-border bg-control-background text-xs"
              >
                <SelectValue>
                  {scope.period === "all"
                    ? "All history"
                    : ORDER_PERIODS.find(
                        (option) => option.value === scope.period,
                      )?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ORDER_PERIODS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      }
      validate={
        orderTypes
          ? (draft) =>
              getUsdRangeError(
                draft.investigation.minUsd,
                draft.investigation.maxUsd,
              ) ||
              getPlacementRangeError(
                draft.investigation.placedSince,
                draft.investigation.placedUntil,
              )
          : undefined
      }
    >
      {(draft, onChange, validation) => (
        <>
          <FilterCombobox
            label="Networks"
            options={networkOptions}
            mode="multiple"
            value={draft.scope.chainIds}
            onChange={(chainIds) =>
              onChange({ ...draft, scope: { ...draft.scope, chainIds } })
            }
          />
          {!partner && (
            <FilterCombobox
              label="Trading apps"
              options={partnerOptions}
              mode="multiple"
              value={draft.scope.partnerIds}
              onChange={(partnerIds) =>
                onChange({ ...draft, scope: { ...draft.scope, partnerIds } })
              }
            />
          )}
          {orderTypes && (
            <InvestigationFilterFields
              value={draft.investigation}
              types={orderTypes}
              validation={validation}
              omitStatus={omitStatus}
              onChange={(investigation) =>
                onChange({ ...draft, investigation })
              }
            />
          )}
        </>
      )}
    </FilterDrawer>
  );
}
