"use client";

import { ActivitySummary, ActivityTime } from "@/components/activity-summary";
import { Copy } from "@/components/ui/copy";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, RefreshCw, User } from "lucide-react";
import { usePerpetualHubUser } from "@/lib/perpetual-hub";
import { appendPerpetualHubScope } from "@/lib/perpetual-hub/query-scope";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { UserLookupResults } from "./dashboard";

export function PerpetualHubUserView({ address }: { address: string }) {
  const searchParams = useSearchParams();
  const scopedHref = (href: string) =>
    appendPerpetualHubScope(href, searchParams);
  const userQuery = usePerpetualHubUser(address);

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-destructive">
        <p className="font-semibold">Invalid user address</p>
        <p className="mt-2 break-all font-mono text-sm">{address}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col px-4 sm:px-6 gap-6 py-4 pb-16">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          </div>
          <div className="mt-1 break-all">
            <Copy text={address} value={address} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={scopedHref(ROUTES.PERPETUAL_HUB.DASHBOARD)}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => userQuery.refetch()}
            disabled={userQuery.isFetching}
          >
            {userQuery.isFetching ? (
              <Spinner size={14} />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {userQuery.isLoading && (
        <Card className="rounded-lg py-10">
          <CardContent className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner size={18} />
            Loading user data
          </CardContent>
        </Card>
      )}

      {userQuery.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Failed to load user data
          </div>
          <p className="mt-1">
            {userQuery.error instanceof Error
              ? userQuery.error.message
              : "Unknown error"}
          </p>
        </div>
      )}

      {userQuery.data && (
        <>
          <ActivitySummary
            title={
              userQuery.data.current
                ? "Current account"
                : "Current account data unavailable"
            }
            tone={userQuery.data.current ? "pending" : "warning"}
            explanation="Your positions and waiting orders are shown below. Activity explains earlier changes. An order being placed does not mean it has traded."
            facts={[
              {
                label: "Last updated",
                value: <ActivityTime value={userQuery.dataUpdatedAt} />,
              },
            ]}
            nextStep="Check waiting orders to see what has not traded yet. Open an activity record to see its result and blockchain confirmation."
          />
          <UserLookupResults data={userQuery.data} />
        </>
      )}
    </div>
  );
}
