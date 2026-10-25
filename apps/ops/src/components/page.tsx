import type { ReactNode } from "react";
import { cn } from "@orbs/domain/utils/utils";

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      id="main-content"
      className={cn(
        "mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6",
        className,
      )}
    >
      {children}
    </main>
  );
}
