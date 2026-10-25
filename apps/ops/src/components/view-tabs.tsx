"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orbs/ui/controls/tabs";
import { cn } from "@orbs/domain/utils/utils";

export function ViewTabs({
  label,
  param,
  tabs,
  defaultValue,
  className,
}: {
  label: string;
  param: string;
  tabs: { value: string; label: string; content: ReactNode }[];
  defaultValue?: string;
  className?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const requested = search.get(param);
  const fallback = tabs.find((tab) => tab.value === defaultValue) ?? tabs[0];
  const active = tabs.find((tab) => tab.value === requested) ?? fallback;
  if (!active) return null;

  return (
    <Tabs
      value={active.value}
      activationMode="manual"
      onValueChange={(value) => {
        const next = new URLSearchParams(search.toString());
        if (value === fallback.value) next.delete(param);
        else next.set(param, value);
        router.push(`${pathname}${next.size ? `?${next}` : ""}`, {
          scroll: false,
        });
      }}
      className={cn("min-w-0 gap-4", className)}
    >
      <TabsList
        aria-label={label}
        className="h-auto w-fit max-w-full flex-wrap justify-start gap-1 rounded-lg bg-control-background p-1"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="min-h-9 flex-none rounded-md border-0 px-3 text-xs text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:text-link data-[state=active]:shadow-none motion-reduce:transition-none dark:data-[state=active]:bg-card dark:data-[state=active]:text-link"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent
        key={active.value}
        value={active.value}
        className="min-w-0 space-y-4 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {active.content}
      </TabsContent>
    </Tabs>
  );
}
