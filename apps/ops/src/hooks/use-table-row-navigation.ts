"use client";

import { useCallback, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

/** Keep native links, text selection, and modified clicks intact inside table rows. */
export function useTableRowNavigation() {
  const router = useRouter();
  return useCallback(
    (event: MouseEvent<HTMLTableRowElement>, href: string) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        (event.button !== 0 && event.button !== 1) ||
        (event.target instanceof Element &&
          event.target.closest(
            "a, button, input, select, textarea, label, details, [role=button], [role=link], [role=checkbox], [role=combobox], [contenteditable=true]",
          )) ||
        window.getSelection()?.isCollapsed === false
      )
        return;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.button === 1
      ) {
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      } else router.push(href);
    },
    [router],
  );
}
