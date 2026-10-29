"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { consolidatedViewHref } from "@/lib/consolidated-navigation";
import { Page } from "./page";
import { PageSkeleton } from "./loading-skeletons";

export function ConsolidatedView({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const href = consolidatedViewHref(pathname, search.toString());
  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);
  return href ? (
    <Page>
      <PageSkeleton />
    </Page>
  ) : (
    children
  );
}
