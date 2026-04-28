"use client";

import Link from "next/link";
import moment from "moment";
import {
  Activity,
  ArrowLeft,
  Database,
  Hash,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { usePerpetualHubRollup } from "@/lib/perpetual-hub";
import { ROUTES } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { shortenAddress } from "@/lib/utils/utils";

function formatNumber(value?: number) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return "Never";
  const milliseconds = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  return moment(milliseconds).format("MMM D, HH:mm:ss");
}

function truncate(value?: string, chars = 6) {
  if (!value) return "-";
  if (value.startsWith("0x") && value.length > 14) return shortenAddress(value, chars);
  if (value.length <= chars * 2 + 3) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-lg py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-all text-2xl font-semibold tabular-nums">
              {value}
            </p>
          </div>
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerpetualHubRollupView({ id }: { id: string }) {
  const { data, isLoading, isError, error } = usePerpetualHubRollup(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Spinner size={28} className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading rollup</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">
        <p className="font-semibold">Failed to load rollup</p>
        <p className="mt-2 text-sm opacity-90">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const { rollup, operations } = data;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 py-4 pb-16">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Rollup #{formatNumber(rollup.id)}
            </h1>
            <Badge variant="outline">{rollup.status}</Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {rollup.txHash || "-"}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={ROUTES.PERPETUAL_HUB.ROOT}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Old Seq"
          value={
            <Link
              href={ROUTES.PERPETUAL_HUB.STATE(rollup.oldSequence)}
              className="text-primary hover:underline"
            >
              #{formatNumber(rollup.oldSequence)}
            </Link>
          }
          icon={Database}
        />
        <MetricCard
          label="New Seq"
          value={
            <Link
              href={ROUTES.PERPETUAL_HUB.STATE(rollup.newSequence)}
              className="text-primary hover:underline"
            >
              #{formatNumber(rollup.newSequence)}
            </Link>
          }
          icon={Database}
        />
        <MetricCard
          label="Operations"
          value={formatNumber(rollup.operationsCount)}
          icon={Activity}
        />
        <MetricCard
          label="Block"
          value={rollup.blockNumber ? formatNumber(rollup.blockNumber) : "-"}
          icon={Layers}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-lg py-4">
          <CardContent className="space-y-3 px-4 text-sm">
            <div>
              <p className="text-muted-foreground">Old root</p>
              <p className="mt-1 break-all font-mono">{rollup.oldStateRoot || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">New root</p>
              <p className="mt-1 break-all font-mono">{rollup.newStateRoot || "-"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-lg py-4">
          <CardContent className="grid gap-3 px-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Submitted</p>
              <p className="mt-1">{formatTimestamp(rollup.submittedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Confirmed</p>
              <p className="mt-1">{formatTimestamp(rollup.confirmedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-lg py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-right font-medium">SeqNo</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Symbol</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Root</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation) => (
                <tr key={operation.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-right font-mono">
                    {operation.teeSequence ? (
                      <Link
                        href={ROUTES.PERPETUAL_HUB.STATE(operation.teeSequence)}
                        className="text-primary hover:underline"
                      >
                        #{formatNumber(operation.teeSequence)}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{operation.operationType}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-primary">
                    {truncate(operation.userAddress)}
                  </td>
                  <td className="px-4 py-3">{operation.symbol || "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      {operation.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <Hash className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                    {truncate(operation.stateRoot)}
                  </td>
                </tr>
              ))}
              {!operations.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    No operations in this rollup
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
