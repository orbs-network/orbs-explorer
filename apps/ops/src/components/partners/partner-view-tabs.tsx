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
  const active = PARTNER_TABS.find((tab) =>
    tab.views.some((candidate) => candidate === view),
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
          <Tabs
            value={view}
            activationMode="manual"
            onValueChange={(value) =>
              router.push(
                partnerHref(partnerId, search, value as PartnerView),
                { scroll: false },
              )
            }
            className="min-w-0 gap-4"
          >
            <TabsList
              aria-label={`${active.label} views`}
              className="h-auto max-w-full justify-start"
            >
              {active.views.map((value) => {
                const option = PARTNER_VIEWS.find(
                  (option) => option.value === value,
                )!;
                return (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="min-h-11 flex-none whitespace-normal px-3 text-xs motion-reduce:transition-none"
                  >
                    {option.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsContent
              value={view}
              className="min-w-0 space-y-4 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {children}
            </TabsContent>
          </Tabs>
        ) : (
          children
        )}
      </TabsContent>
    </Tabs>
  );
}
