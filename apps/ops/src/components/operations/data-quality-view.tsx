"use client";

import {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@orbs/ui/controls/table";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, CheckCircle2, CircleAlert } from "lucide-react";
import { getPartnerChainPairs } from "@orbs/domain/twap/utils/orders-overview";
import { Button } from "@orbs/ui/controls/button";
import { buildDataQuality } from "@/lib/data-quality";
import {
  formatOrderDate,
  formatShare,
} from "@/components/orders-overview/overview-display";
import { useOperationsData } from "./operations-view";
import { Panel, TableFrame, EmptyState } from "./primitives";
import { InfoHint } from "@/components/info-hint";

import { ViewTabs } from "@/components/view-tabs";
import { globalScopeHref } from "@/lib/partner-navigation";

function useDataQuality() {
  const { orders, updatedAt, config } = useOperationsData();
  return useMemo(
    () => buildDataQuality(orders, updatedAt, config),
    [orders, updatedAt, config],
  );
}

function FieldChecks() {
  const { orders, inspectOrders } = useOperationsData();
  const quality = useDataQuality();
  const search = useSearchParams();
  const fieldOrders = [
    ...new Set(quality.fields.flatMap((field) => field.missing)),
  ];
  const consistencyOrders = [
    ...new Set([
      ...quality.statusConflicts,
      ...quality.excessProgress,
      ...quality.duplicates,
    ]),
  ];
  const consistencySearch = new URLSearchParams(search.toString());
  consistencySearch.set("data_view", "consistency");
  if (!orders.length) return <EmptyState />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {fieldOrders.length ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              inspectOrders(
                "Missing or invalid fields",
                fieldOrders,
                "Unique orders with missing or invalid values in the field checks below.",
              )
            }
          >
            Review {fieldOrders.length.toLocaleString()} orders with field
            issues
          </Button>
        ) : (
          <p role="status" className="flex items-center gap-2">
            <CheckCircle2 aria-hidden className="size-4 text-success" />
            Required fields valid
          </p>
        )}
        {consistencyOrders.length > 0 && (
          <Link
            href={`?${consistencySearch}`}
            className="inline-flex min-h-9 items-center gap-1 rounded text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {consistencyOrders.length.toLocaleString()} orders need consistency
            review
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        )}
      </div>
      <Panel
        title="Field coverage"
        description="Select an issue count to review orders. Counts can overlap."
      >
        <TableFrame label="Order field coverage">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Field</TableHead>
              <TableHead scope="col">Valid records</TableHead>
              <TableHead scope="col">Missing / invalid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quality.fields.map((field) => (
              <TableRow key={field.key}>
                <TableHead
                  scope="row"
                  className="min-w-44 font-medium text-foreground"
                >
                  <span className="inline-flex items-center gap-1">
                    {field.label}
                    <InfoHint>{field.description}</InfoHint>
                  </span>
                </TableHead>
                <TableCell className="whitespace-nowrap">
                  {field.present.toLocaleString()}{" "}
                  <span className="text-muted-foreground">
                    ({formatShare(field.present, orders.length)})
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="content"
                    type="button"
                    disabled={!field.missing.length}
                    onClick={() =>
                      inspectOrders(
                        `${field.label}: missing or invalid`,
                        field.missing,
                        field.description,
                      )
                    }
                    className="-mx-2 -my-1 inline-flex items-center gap-1 rounded px-2 py-1 font-medium enabled:text-warning enabled:hover:bg-warning-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:font-normal disabled:text-muted-foreground"
                    aria-label={`Inspect ${field.missing.length} orders with missing or invalid ${field.label.toLowerCase()}`}
                  >
                    {field.missing.length.toLocaleString()}
                    {field.missing.length > 0 && (
                      <ChevronRight aria-hidden className="size-3" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableFrame>
      </Panel>
    </div>
  );
}

function ConsistencyChecks() {
  const { orders, inspectOrders } = useOperationsData();
  const quality = useDataQuality();
  if (!orders.length) return <EmptyState />;
  return (
    <Panel
      title="Consistency review"
      description="Review flags indicate records worth investigating; they are not proof of an execution error."
    >
      <div className="space-y-3">
        {[
          {
            label: "Lifecycle / termination reason needs review",
            orders: quality.statusConflicts,
            note: "Flags contradictory structured statuses, or a Failed lifecycle with an expiry/cancellation description. Descriptions are review cues; they never silently reclassify an order. Details retain raw values and reasons.",
          },
          {
            label: "Success count exceeds planned chunks",
            orders: quality.excessProgress,
            note: "Only compares reported numeric counts when the plan is greater than zero.",
          },
          {
            label: "Duplicate network + order hash",
            orders: quality.duplicates,
            note: "Checks the loaded list after service deduplication; multiple source copies are normally collapsed.",
          },
        ].map((item) => (
          <Button
            variant="ghost"
            size="content"
            key={item.label}
            type="button"
            disabled={!item.orders.length}
            onClick={() => inspectOrders(item.label, item.orders, item.note)}
            className="flex w-full items-center justify-between gap-4 rounded-lg bg-muted/40 p-3 text-left enabled:hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          >
            <span className="text-sm font-medium">{item.label}</span>
            <strong
              className={`tabular-nums ${item.orders.length ? "" : "font-normal text-muted-foreground"}`}
            >
              {item.orders.length.toLocaleString()}
            </strong>
          </Button>
        ))}
      </div>
    </Panel>
  );
}

function SnapshotCoverage() {
  const { allOrders, config, updatedAt, scope, error } = useOperationsData();
  const search = useSearchParams();
  const inventory = useMemo(
    () =>
      getPartnerChainPairs(config).filter(
        (pair) => Number.isInteger(pair.chainId) && pair.chainId > 0,
      ),
    [config],
  );
  return (
    <Panel
      title="Snapshot & coverage"
      description="These checks describe the retrieved dataset. They do not measure service uptime, RPC health, or event ingestion delay."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={globalScopeHref("/adapters", search.toString())}>
            View adapters
          </Link>
        </Button>
      }
    >
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">
            Last successful order retrieval
          </dt>
          <dd className="mt-1">{formatOrderDate(updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Latest refresh result
          </dt>
          <dd className="mt-1 flex items-center gap-1.5">
            {error ? (
              <>
                <CircleAlert aria-hidden className="size-4 text-warning" />
                Failed · showing cached data
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden className="size-4 text-success" />
                Loaded
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Orders in retrieved history
          </dt>
          <dd className="mt-1 tabular-nums">
            {allOrders.length.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Configuration</dt>
          <dd className="mt-1">
            {config
              ? `${inventory.length.toLocaleString()} app / network adapters`
              : "Unavailable"}
          </dd>
        </div>
      </dl>
      {scope.days && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Period filters can exclude undated records. Audit all history to
            check those records.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => scope.setPeriod("all")}
          >
            Audit all history
          </Button>
        </div>
      )}
    </Panel>
  );
}

export function DataQualityView() {
  return (
    <ViewTabs
      label="Data check views"
      param="data_view"
      tabs={[
        { value: "fields", label: "Field checks", content: <FieldChecks /> },
        {
          value: "consistency",
          label: "Consistency",
          content: <ConsistencyChecks />,
        },
        { value: "snapshot", label: "Snapshot", content: <SnapshotCoverage /> },
      ]}
    />
  );
}
