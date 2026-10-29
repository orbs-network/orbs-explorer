"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@orbs/domain/utils/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orbs/ui/controls/tabs";

export type NavigationDestination = {
  label: string;
  shortLabel?: string;
  description?: string;
  href: string;
  current?: "page" | "true";
};

export type NavigationSection = {
  label: string;
  active: boolean;
  items: NavigationDestination[];
};

export function ViewNavigation({
  label,
  sections,
  brand,
  actions,
  children,
}: {
  label: string;
  sections: NavigationSection[];
  brand: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const section = sections.find((section) => section.active);
  const current = section?.items.find((item) => item.current);
  const hasTabs = Boolean(section && section.items.length > 1);
  const active = current?.href ?? "context";

  return (
    <Tabs
      value={active}
      activationMode="manual"
      onValueChange={(href) => router.push(href, { scroll: false })}
      className="gap-0"
    >
      <header className="border-b border-border bg-navigation">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-6">
          {brand}
          <nav
            aria-label={label}
            className="order-3 col-span-2 min-w-0 border-t border-border/60 lg:order-none lg:col-span-1 lg:border-0"
          >
            <ul
              className="grid gap-1 py-1 lg:flex"
              style={{
                gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
              }}
            >
              {sections.map((section) => {
                const destination =
                  section.items.find((item) => item.current) ??
                  section.items[0];
                return (
                  <li key={section.label} className="min-w-0">
                    <Link
                      href={destination.href}
                      aria-current={
                        section.active
                          ? section.items.length === 1
                            ? (destination.current ?? "true")
                            : "true"
                          : undefined
                      }
                      className={cn(
                        "flex min-h-11 items-center justify-center rounded-md px-1 text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:px-3 sm:text-sm lg:min-h-8",
                        section.active
                          ? "bg-foreground font-semibold text-background hover:bg-foreground/90 hover:text-background"
                          : "text-muted-foreground",
                      )}
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex min-h-14 items-center justify-end gap-1">
            {actions}
          </div>
        </div>
        {section && (hasTabs || current?.description) && (
          <div className="border-t border-border/60">
            <div className="mx-auto flex max-w-[1440px] min-w-0 flex-wrap items-center gap-x-5 gap-y-1 px-4 sm:px-6">
              {hasTabs && (
                <TabsList
                  aria-label={`${section.label} pages`}
                  className="grid h-auto min-h-0 w-full gap-1 rounded-none bg-transparent p-0 sm:flex sm:w-auto"
                  style={{
                    gridTemplateColumns: `repeat(${section.items.length}, minmax(0, 1fr))`,
                  }}
                >
                  {section.items.map((item) => (
                    <TabsTrigger
                      key={item.href}
                      value={item.href}
                      title={item.label}
                      onClick={() => {
                        if (item.current === "true")
                          router.push(item.href, { scroll: false });
                      }}
                      className="min-h-11 min-w-0 whitespace-normal rounded-none border-0 border-b-2 border-transparent px-1.5 text-center text-[11px] leading-4 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none motion-reduce:transition-none dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-primary sm:flex-none sm:whitespace-nowrap sm:px-3 sm:text-xs lg:min-h-9"
                    >
                      {item.shortLabel ?? item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}
            </div>
          </div>
        )}
      </header>
      {hasTabs ? (
        <TabsContent
          value={active}
          className="min-w-0 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </TabsContent>
      ) : (
        children
      )}
    </Tabs>
  );
}
