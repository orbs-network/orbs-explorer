"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { previousPageIndex, type PagePosition } from "@/lib/page-history";

const ENTRY_KEY = "orbsPageHistoryIndex";
const STORAGE_KEY = "orbs-ops-page-history-v1";
type Position = PagePosition;
const PageHistory = createContext<((fallbackHref: string) => void) | null>(
  null,
);
const currentHref = () => {
  const search = new URLSearchParams(window.location.search).toString();
  return `${window.location.pathname}${search ? `?${search}` : ""}`;
};

function entryIndex(state: unknown): number | undefined {
  const index =
    state && typeof state === "object" && ENTRY_KEY in state
      ? state[ENTRY_KEY]
      : undefined;
  return typeof index === "number" && Number.isSafeInteger(index) && index >= 0
    ? index
    : undefined;
}

function readPositions(): Record<number, Position> {
  try {
    const stored: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || "{}",
    );
    if (!stored || typeof stored !== "object" || Array.isArray(stored))
      return {};
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([key, value]) =>
          /^\d+$/.test(key) &&
          value &&
          typeof value.href === "string" &&
          value.href.startsWith("/") &&
          !value.href.startsWith("//") &&
          Number.isFinite(value.top) &&
          value.top >= 0,
      ),
    );
  } catch {
    return {};
  }
}

/** Return to the previous page, retaining its filters and virtual-list position. */
export function PageHistoryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = `${pathname}${search ? `?${search}` : ""}`;
  const index = useRef(0);
  const positions = useRef<Record<number, Position>>({});
  const pending = useRef<Position | null>(null);
  const [popVersion, setPopVersion] = useState(0);

  useEffect(() => {
    const history = window.history;
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const restoredIndex = entryIndex(history.state);
    index.current = restoredIndex ?? 0;
    positions.current = restoredIndex === undefined ? {} : readPositions();
    const persist = () => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions.current));
      } catch {
        /* Navigation still works without storage. */
      }
    };
    const saveScroll = () => {
      if (!pending.current)
        positions.current[index.current] = {
          href: currentHref(),
          top: window.scrollY,
        };
    };
    const saveBeforeLeaving = () => {
      pending.current = null;
      saveScroll();
      persist();
    };
    saveScroll();
    originalReplace.call(
      history,
      { ...history.state, [ENTRY_KEY]: index.current },
      "",
    );

    const push: History["pushState"] = (state, unused, url) => {
      // Scroll is captured before React replaces the outgoing page's content.
      persist();
      const next = index.current + 1;
      originalPush.call(history, { ...state, [ENTRY_KEY]: next }, unused, url);
      index.current = next;
      positions.current[next] = { href: currentHref(), top: 0 };
      persist();
    };
    const replace: History["replaceState"] = (state, unused, url) => {
      originalReplace.call(
        history,
        { ...state, [ENTRY_KEY]: index.current },
        unused,
        url,
      );
      const previous = positions.current[index.current];
      positions.current[index.current] = {
        href: currentHref(),
        top: previous?.top ?? window.scrollY,
      };
      persist();
    };
    const onPop = (event: PopStateEvent) => {
      index.current = entryIndex(event.state) ?? 0;
      pending.current = positions.current[index.current] ?? {
        href: currentHref(),
        top: 0,
      };
      setPopVersion((version) => version + 1);
    };
    const cancelRestore = () => {
      pending.current = null;
    };
    history.pushState = push;
    history.replaceState = replace;
    window.addEventListener("popstate", onPop);
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pointerdown", saveBeforeLeaving, true);
    window.addEventListener("keydown", saveBeforeLeaving, true);
    window.addEventListener("pagehide", saveBeforeLeaving);
    window.addEventListener("wheel", cancelRestore, { passive: true });
    window.addEventListener("touchstart", cancelRestore, { passive: true });
    return () => {
      saveBeforeLeaving();
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace)
        history.replaceState = originalReplace;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pointerdown", saveBeforeLeaving, true);
      window.removeEventListener("keydown", saveBeforeLeaving, true);
      window.removeEventListener("pagehide", saveBeforeLeaving);
      window.removeEventListener("wheel", cancelRestore);
      window.removeEventListener("touchstart", cancelRestore);
    };
  }, []);

  useEffect(() => {
    const target = pending.current;
    if (!target || target.href !== href) return;
    let frame = 0;
    let settled = 0;
    const started = performance.now();
    const restore = () => {
      if (pending.current !== target) return;
      window.scrollTo(0, target.top);
      settled = Math.abs(window.scrollY - target.top) < 2 ? settled + 1 : 0;
      if (settled >= 2 || performance.now() - started > 10_000)
        pending.current = null;
      else frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [href, popVersion]);

  const goBack = useCallback(
    (fallbackHref: string) => {
      const previous = previousPageIndex(
        positions.current,
        index.current,
        currentHref(),
      );
      if (previous !== undefined) window.history.go(previous - index.current);
      else router.replace(fallbackHref);
    },
    [router],
  );

  return <PageHistory value={goBack}>{children}</PageHistory>;
}

export function usePageBack() {
  const goBack = use(PageHistory);
  if (!goBack) throw new Error("BackButton must be inside PageHistoryProvider");
  return goBack;
}
