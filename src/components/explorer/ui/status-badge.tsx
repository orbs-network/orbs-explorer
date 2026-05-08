import { cn } from "@/lib/utils/utils";
import { Check, Clock, X } from "lucide-react";

type Props = {
  status: string;
  className?: string;
};

type Tone = "success" | "pending" | "failed" | "neutral";

function classify(status: string): Tone {
  const s = status.toLowerCase();
  if (s.includes("confirm") || s.includes("success") || s.includes("complete")) return "success";
  if (s.includes("pending") || s.includes("submitt") || s.includes("await")) return "pending";
  if (s.includes("fail") || s.includes("error") || s.includes("reject")) return "failed";
  return "neutral";
}

const STYLES: Record<Tone, { className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  success: {
    className: "bg-[var(--explorer-success)]/15 text-[var(--explorer-success)]",
    Icon: Check,
  },
  pending: {
    className: "bg-[var(--explorer-warning)]/15 text-[var(--explorer-warning)]",
    Icon: Clock,
  },
  failed: {
    className: "bg-destructive/15 text-destructive",
    Icon: X,
  },
  neutral: {
    className: "bg-muted text-muted-foreground",
    Icon: Clock,
  },
};

export function StatusBadge({ status, className }: Props) {
  const tone = classify(status);
  const { className: toneClass, Icon } = STYLES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        toneClass,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}
