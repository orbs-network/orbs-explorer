"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrderLogsUI } from "@orbs/domain/twap/api";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import { Copy } from "@orbs/ui/controls/copy";
import { formatOrderDate } from "@/components/orders-overview/overview-display";
import { EmptyState } from "@/components/operations/primitives";

function eventLabel(record: Record<string, unknown>, index: number): string {
  for (const key of [
    "message",
    "event",
    "eventName",
    "description",
    "action",
    "type",
    "level",
  ]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return `Client event ${index + 1}`;
}

export function OrderClientLogs({ hash }: { hash: string }) {
  const [requested, setRequested] = useState(false);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["ops-order-client-logs", hash],
    queryFn: ({ signal }) => getOrderLogsUI(hash, signal),
    enabled: requested,
    retry: 1,
    staleTime: 60_000,
  });
  const records = query.data;
  const visible = useMemo(
    () =>
      (records ?? []).filter((record) =>
        JSON.stringify(record)
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [records, search],
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => {
            setRequested(true);
            void query.refetch();
          }}
        >
          {query.isFetching
            ? "Loading client logs…"
            : requested || records
              ? "Refresh client logs"
              : "Load client logs"}
        </Button>
        {records && (
          <span className="text-xs text-muted-foreground">
            {records.length.toLocaleString()} events returned · fetched{" "}
            {formatOrderDate(query.dataUpdatedAt)}
          </span>
        )}
      </div>
      {query.isFetching && !records && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading client events for this hash…
        </p>
      )}
      {query.isError && (
        <div
          role="alert"
          className={`rounded-lg p-4 text-sm ${records ? "bg-amber-500/10" : "bg-destructive/10"}`}
        >
          <p className="font-medium">
            {records
              ? "Client log refresh failed"
              : "Client logs could not be loaded"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {records
              ? `Showing ${records.length.toLocaleString()} cached events fetched ${formatOrderDate(query.dataUpdatedAt)}. Refresh client logs to try again.`
              : "The log service may be unavailable. Refresh client logs to try again; full order details remain available."}
          </p>
        </div>
      )}
      {records && records.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              name="client_log_search"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search returned client logs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search any event field…"
              className="max-w-md"
            />
            <p role="status" className="text-xs text-muted-foreground">
              {visible.length} of {records.length} returned events
            </p>
            <Copy
              text="Copy returned client logs JSON"
              value={JSON.stringify(records, null, 2)}
            />
          </div>
          <div className="max-h-[36rem] space-y-2 overflow-auto overscroll-contain">
            {visible.map((record, index) => (
              <details
                key={index}
                className="rounded-lg bg-muted/40 p-3"
              >
                <summary className="cursor-pointer rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="break-words">
                    {eventLabel(record, index)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {typeof record.timestamp === "string" ||
                    typeof record.timestamp === "number"
                      ? formatOrderDate(record.timestamp)
                      : "Timestamp not provided"}
                  </span>
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                  {JSON.stringify(record, null, 2)}
                </pre>
              </details>
            ))}
          </div>
          {!visible.length && (
            <EmptyState
              title="No matching client events"
              description="Change the event search to inspect the returned records."
            />
          )}
        </>
      )}
      {records && !records.length && (
        <EmptyState
          title="No client logs returned"
          description="No events were returned for this hash. Client-event coverage and retention vary independently of order execution data."
        />
      )}
    </div>
  );
}
