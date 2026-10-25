"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { consolidatedViewHref } from "@/lib/consolidated-navigation";

export function ConsolidatedView({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const href = consolidatedViewHref(pathname, search.toString());
  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);
  return href ? (
    <p role="status" className="p-6 text-sm text-muted-foreground">
      Opening view…
    </p>
  ) : (
    children
  );
}
