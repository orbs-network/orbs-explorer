"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * URL-driven pagination state for explorer list pages.
 *
 *   const { page, pageSize, setPage, setPageSize, limit, offset } =
 *     useListPagination({ defaultPageSize: 25, allowedSizes: [25, 50, 100] });
 *
 * - `page` is 1-indexed (URL: `?page=3`)
 * - `pageSize` is read from `?size=` and validated against `allowedSizes`
 * - `setPage` / `setPageSize` write back to the URL (replace, no scroll jump)
 * - `limit` / `offset` are derived for handing to the backend client
 */
type Options = {
  defaultPageSize: number;
  allowedSizes: readonly number[];
};

export function useListPagination({ defaultPageSize, allowedSizes }: Options) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawPage = Number(searchParams.get("page"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;

  const rawSize = Number(searchParams.get("size"));
  const pageSize = allowedSizes.includes(rawSize) ? rawSize : defaultPageSize;

  const writeParams = useCallback(
    (updates: Record<string, number | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const clamped = Math.max(1, Math.trunc(nextPage));
      writeParams({ page: clamped === 1 ? undefined : clamped });
    },
    [writeParams]
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      if (!allowedSizes.includes(nextSize)) return;
      // Reset to page 1 — current offset would point past the end if the
      // page got bigger, and the page-1 case omits the param entirely.
      writeParams({
        size: nextSize === defaultPageSize ? undefined : nextSize,
        page: undefined,
      });
    },
    [allowedSizes, defaultPageSize, writeParams]
  );

  return useMemo(
    () => ({
      page,
      pageSize,
      setPage,
      setPageSize,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [page, pageSize, setPage, setPageSize]
  );
}
