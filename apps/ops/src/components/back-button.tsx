"use client";

import { ArrowLeft } from "lucide-react";
import { usePageBack } from "./page-history-provider";

export function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const goBack = usePageBack();

  return (
    <button
      type="button"
      onClick={() => goBack(fallbackHref)}
      className="inline-flex min-h-8 items-center gap-1.5 rounded text-sm text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back
    </button>
  );
}
