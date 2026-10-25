import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function CardDisclosure({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group/disclosure border-t border-border/60">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-[4px] py-2 text-xs font-medium transition-colors hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {detail && (
            <span className="text-[10px] font-normal tabular-nums text-muted-foreground">
              {detail}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className="size-3.5 text-muted-foreground transition-transform group-open/disclosure:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}
