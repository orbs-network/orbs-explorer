"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
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
import { FilterFieldsSkeleton } from "./loading-skeletons";
import {
  DEFAULT_INVESTIGATION_FILTERS,
  getUsdRangeError,
  getPlacementRangeError,
  getSwapperAddressError,
  type InvestigationFilters,
} from "@/lib/order-investigation";
import { investigationFilterQuery } from "@/lib/investigation-filter-query";
import { orderHashSearchHref } from "@/lib/order-quick-views";
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
  periodLabel = "Order period",
  isLoading = false,
}: {
  scope: ReturnType<typeof useOrderScope>;
  networkOptions: FilterOption[];
  partnerOptions: FilterOption[];
  partner?: { id: string; label: string };
  orderTypes?: string[];
  applicationMode?: FilterApplicationMode;
  periodLabel?: string | null;
  isLoading?: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const { filters } = useInvestigationFilters();
  const value: FilterValue = {
    scope: {
      period: scope.period,
      chainIds: scope.chainIds,
      partnerIds: partner ? [partner.id] : scope.partnerIds,
    },
    investigation: filters,
  };
  const apply = (next: FilterValue) => {
    const nextScope =
      orderTypes &&
      (next.investigation.placedSince || next.investigation.placedUntil)
        ? { ...next.scope, period: "all" }
        : next.scope;
    const investigation: Record<string, string | undefined> = orderTypes
      ? investigationFilterQuery(next.investigation)
      : {};
    if (orderTypes) {
      const query = new URLSearchParams(scope.query);
      for (const [key, value] of Object.entries(investigation)) {
        if (value === undefined) query.delete(key);
        else query.set(key, value);
      }
      const href = orderHashSearchHref(next.investigation.query, {
        ...nextScope,
        partnerId: partner?.id,
        query: query.toString(),
      });
      if (href) {
        router.push(href);
        return;
      }
    }
    scope.applyFilters(nextScope, investigation);
  };
  const clearValue: FilterValue = {
    scope: {
      period: scope.period,
      chainIds: [],
      partnerIds: partner ? [partner.id] : [],
    },
    investigation: { ...DEFAULT_INVESTIGATION_FILTERS, sort: filters.sort },
  };
  const badges: FilterBadge[] = [];
  for (const chainId of scope.chainIds)
    badges.push({
      key: `chain-${chainId}`,
      category: "network",
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
        category: "trading-app",
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
      emptyLabel=""
      toolbarControls={
        periodLabel === null ? undefined : (
          <div className="mr-2 flex shrink-0 items-center gap-2">
            <label htmlFor={`${id}-period`} className="sr-only">
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
                aria-label={periodLabel ?? undefined}
                className="h-8 w-36 border-control-border bg-control-background text-xs"
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
              getSwapperAddressError(draft.investigation.swapper) ||
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
      {(draft, onChange, validation) => {
        const scopeFields = isLoading ? (
          <FilterFieldsSkeleton />
        ) : (
          <>
            <FilterCombobox
              label="Networks"
              emptyLabel="Select networks"
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
                emptyLabel="All trading apps"
                options={partnerOptions}
                mode="multiple"
                value={draft.scope.partnerIds}
                onChange={(partnerIds) =>
                  onChange({ ...draft, scope: { ...draft.scope, partnerIds } })
                }
              />
            )}
          </>
        );
        return orderTypes ? (
          <InvestigationFilterFields
            value={draft.investigation}
            types={orderTypes}
            validation={validation}
            onChange={(investigation) => onChange({ ...draft, investigation })}
          >
            {scopeFields}
          </InvestigationFilterFields>
        ) : (
          scopeFields
        );
      }}
    </FilterDrawer>
  );
}
