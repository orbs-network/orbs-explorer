"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orbs/ui/controls/tabs";
import {
  PARTNER_TABS,
  PARTNER_VIEWS,
  partnerHref,
  type PartnerView,
} from "@/lib/partner-navigation";

export function PartnerViewTabs({
  partnerId,
  search,
  view,
  children,
}: {
  partnerId: string;
  search: string;
  view: PartnerView;
  children: ReactNode;
}) {
  const router = useRouter();
  const active = PARTNER_TABS.find(
    (tab) =>
      tab.views.some((candidate) => candidate === view) ||
      (view === "lookup" && tab.value === "orders"),
  )!;
  return (
    <Tabs
      value={active.value}
      activationMode="manual"
      onValueChange={(value) => {
        const next = PARTNER_TABS.find((tab) => tab.value === value);
        if (next)
          router.push(partnerHref(partnerId, search, next.views[0]), {
            scroll: false,
          });
      }}
      className="gap-4"
    >
      <TabsList
        aria-label="Partner sections"
        className="grid w-full grid-cols-5 gap-0 rounded-none border-b border-border bg-transparent p-0 sm:flex sm:w-fit"
      >
        {PARTNER_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="min-h-11 min-w-0 rounded-none border-0 border-b-2 border-transparent px-1 text-[10px] text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none motion-reduce:transition-none dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent sm:min-w-24 sm:px-4 sm:text-xs"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent
        value={active.value}
        className="min-w-0 space-y-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {active.views.length > 1 ? (
          <div className="space-y-4">
            <label className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {active.label === "Execution"
                ? "Review"
                : active.label === "Markets"
                  ? "Analyze"
                  : "Measure"}
              <select
                aria-label={`${active.label} question`}
                value={view}
                onChange={(event) =>
                  router.push(
                    partnerHref(
                      partnerId,
                      search,
                      event.target.value as PartnerView,
                    ),
                    { scroll: false },
                  )
                }
                className="h-10 max-w-full rounded-md bg-control-background px-3 text-foreground"
              >
                {active.views.map((value) => (
                  <option key={value} value={value}>
                    {
                      PARTNER_VIEWS.find((option) => option.value === value)
                        ?.label
                    }
                  </option>
                ))}
              </select>
            </label>
            {children}
          </div>
        ) : (
          children
        )}
      </TabsContent>
    </Tabs>
  );
}
