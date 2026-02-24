"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Page } from "@/components/page";
import { Send, Loader2, Bell, CheckCircle2, XCircle, FileSearch } from "lucide-react";
import { toast } from "sonner";

type Result = {
  ok?: boolean;
  checked?: number;
  errorChunks?: number;
  sent?: number;
  error?: string;
};

export default function RunTelegramAlertsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleRun() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/run-telegram-alerts");
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        toast.success(
          data.sent
            ? `Sent ${data.sent} alert${data.sent === 1 ? "" : "s"}`
            : "No new errors to report",
          { description: `Checked ${data.checked ?? 0} orders` }
        );
      } else if (data.error) {
        toast.error("Alert run failed", { description: data.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setResult({ error: msg });
      toast.error("Request failed", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Page>
      <div className="py-8 max-w-lg mx-auto flex flex-col items-center">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-border/80 mb-8 w-full text-center">
          <div className="relative z-10 px-4 py-6 sm:px-8 sm:py-8 flex flex-col items-center">
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Bell className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Telegram Alerts
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Run error alerts
            </h1>
            <p className="text-muted-foreground mt-1 max-w-md text-center">
              Manually trigger the cron job. Fetches orders, finds chunk errors,
              and sends Telegram notifications for new ones.
            </p>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader className="text-center sm:text-left">
            <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
              <Send className="h-5 w-5" />
              Trigger alerts
            </CardTitle>
            <CardDescription>
              Checks the order-sink API and sends a message for each new chunk
              error that has an extraTitle.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 items-center">
            <Button
              onClick={handleRun}
              disabled={loading}
              size="lg"
              className="w-fit"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Run alerts
                </>
              )}
            </Button>

            {result && (
              <div className="space-y-4 w-full">
                {result.error ? (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                    <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Error</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {result.error}
                      </p>
                    </div>
                  </div>
                ) : result.ok ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                      <p className="font-medium text-foreground">Run completed</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard
                        icon={FileSearch}
                        label="Orders checked"
                        value={result.checked ?? 0}
                      />
                      <StatCard
                        icon={Bell}
                        label="Error chunks"
                        value={result.errorChunks ?? 0}
                      />
                      <StatCard
                        icon={Send}
                        label="Alerts sent"
                        value={result.sent ?? 0}
                        highlight
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof FileSearch;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-muted/30"
      }`}
    >
      <Icon className="h-4 w-4 mx-auto mb-1.5 text-muted-foreground" />
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
