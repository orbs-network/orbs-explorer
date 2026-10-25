"use client";

import { useId, type ReactNode } from "react";
import { InfoHint } from "@/components/info-hint";

export function ChartFrame({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`min-w-0 rounded-xl bg-card p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 id={id} className="font-semibold">
            {title}
          </h2>
          <InfoHint>{description}</InfoHint>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
