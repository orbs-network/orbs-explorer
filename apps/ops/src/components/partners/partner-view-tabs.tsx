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
  partnerHref,
  type PartnerView,
} from "@/lib/partner-navigation";

export function PartnerViewTabs({
  partnerId,
  search,
  view,
  controls,
  children,
}: {
  partnerId: string;
  search: string;
  view: PartnerView;
  controls?: ReactNode;
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
      className="min-w-0 gap-3"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <TabsList
          aria-label="Partner sections"
          className="min-h-11 flex-nowrap gap-6 rounded-none bg-transparent p-0 sm:gap-8"
        >
          {PARTNER_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="relative min-h-11 flex-none rounded-none border-0 bg-transparent px-0 py-2 text-sm font-medium text-muted-foreground shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-primary motion-reduce:transition-none dark:hover:text-foreground dark:data-[state=active]:bg-transparent"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {controls && <div className="min-w-0 max-w-full">{controls}</div>}
      </div>
      <TabsContent
        value={active.value}
        className="min-w-0 space-y-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </TabsContent>
    </Tabs>
  );
}
