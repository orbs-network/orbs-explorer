"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import { useState, type ReactNode } from "react";
import { globalScopeHref } from "@/lib/partner-navigation";
import { ViewNavigation } from "./view-navigation";
import { QuickOrderSearch } from "./investigation/quick-order-search";
import { MetricDefinitions } from "./metric-definitions";
import { ConsolidatedView } from "./consolidated-view";

const groups = [
  {
    label: "Overview",
    links: [
      {
        href: "/",
        label: "Overview",
      },
    ],
  },
  {
    label: "Orders",
    links: [
      {
        href: "/orders",
        label: "All orders",
        description: "Find an order, review its details, or search by hash.",
      },
      {
        href: "/failures",
        label: "Errors & failures",
        description:
          "Understand what went wrong and which orders were affected.",
      },
    ],
  },
  {
    label: "Analytics",
    links: [
      {
        href: "/charts",
        label: "Activity",
        description:
          "See when orders arrive and how activity changes over time.",
      },
      {
        href: "/markets",
        label: "Tokens & pairs",
        description:
          "Explore which tokens are traded and the most popular swap pairs.",
      },
      {
        href: "/performance",
        label: "Order outcomes",
        description:
          "Compare order outcomes and sizes across apps and networks.",
      },
    ],
  },
  {
    label: "Monitoring",
    links: [
      {
        href: "/security",
        label: "Service & security",
        description:
          "Check service health, worker coverage, unusual activity, and adapter addresses.",
      },
      {
        href: "/adapters",
        label: "Adapters",
        description:
          "Compare configured adapter addresses with order activity and check an address.",
      },
      {
        href: "/data-quality",
        label: "Data checks",
        description:
          "Find missing order details, inconsistent records, and gaps in app configuration.",
      },
    ],
  },
];

export function StaffNav({
  email,
  accessMode,
  children,
}: {
  email: string;
  accessMode: "disabled" | "local" | "google";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { partnerId } = useParams<{ partnerId?: string }>();
  const scopedHref = (href: string) =>
    globalScopeHref(href, searchParams.toString(), partnerId);
  const { resolvedTheme, setTheme } = useTheme();
  const [error, setError] = useState("");
  return (
    <ViewNavigation
      brand={
        <Link
          href={scopedHref("/")}
          aria-label="Orbs Operations home"
          className="flex w-fit shrink-0 items-center gap-2 rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/orbs/orbs-mark.svg"
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0"
          />
          <span className="whitespace-nowrap">
            Orbs <span className="font-normal text-muted-foreground">Ops</span>
          </span>
        </Link>
      }
      actions={
        <>
          <QuickOrderSearch key={pathname} />
          <MetricDefinitions />
          {accessMode === "google" && (
            <span className="hidden max-w-40 truncate text-xs text-muted-foreground xl:inline">
              {email}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun aria-hidden className="size-4 dark:hidden" />
            <Moon aria-hidden className="hidden size-4 dark:block" />
          </Button>
          {accessMode === "google" && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch("/api/auth/session", {
                    method: "DELETE",
                  });
                  if (!response.ok) throw new Error();
                  window.location.assign("/login");
                } catch {
                  setError("Sign-out failed. Try again.");
                }
              }}
            >
              Sign out
            </Button>
          )}
          {error && (
            <span role="alert" className="text-xs text-destructive">
              {error}
            </span>
          )}
        </>
      }
      label="Operations navigation"
      sections={groups.map((group) => ({
        label: group.label,
        active:
          group.links.some(
            (item) =>
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
          ) ||
          (group.label === "Overview" && Boolean(partnerId)),
        items: group.links.map((item) => ({
          ...item,
          current:
            pathname === item.href
              ? ("page" as const)
              : item.href !== "/" && pathname.startsWith(`${item.href}/`)
                ? ("true" as const)
                : undefined,
          href: scopedHref(item.href),
        })),
      }))}
    >
      <ConsolidatedView>{children}</ConsolidatedView>
    </ViewNavigation>
  );
}
