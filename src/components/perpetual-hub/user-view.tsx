"use client";

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
        <p className="mt-2 font-mono text-sm">{address}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 py-4 pb-16">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">User</h1>
          </div>
          <p className="mt-1 truncate font-mono text-sm text-muted-foreground">
            {address}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={scopedHref(ROUTES.PERPETUAL_HUB.ROOT)}>
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

      {userQuery.data && <UserLookupResults data={userQuery.data} />}
    </div>
  );
}
