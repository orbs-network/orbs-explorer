import { cn } from "@/lib/utils/utils";

type Props = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
};

const TONES: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-foreground",
  success: "text-[var(--explorer-success)]",
  warning: "text-[var(--explorer-warning)]",
  danger: "text-destructive",
};

export function StatCard({ label, value, sublabel, tone = "default", className }: Props) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card px-4 py-3 min-w-0",
        className
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-xl font-semibold tabular-nums truncate", TONES[tone])}>
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-[11px] text-muted-foreground truncate">{sublabel}</p>
      ) : null}
    </div>
  );
}
