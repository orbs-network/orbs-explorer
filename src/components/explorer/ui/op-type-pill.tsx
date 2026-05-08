import { cn } from "@/lib/utils/utils";

type Props = {
  type?: string;
  className?: string;
};

type Tone = "trade" | "deposit" | "withdraw" | "liquidation" | "cancel" | "order" | "neutral";

function classify(type: string | undefined): Tone {
  if (!type) return "neutral";
  const t = type.toLowerCase();
  if (t.includes("liquidat")) return "liquidation";
  if (t.includes("trade") || t.includes("fill") || t.includes("match")) return "trade";
  if (t.includes("deposit")) return "deposit";
  if (t.includes("withdraw")) return "withdraw";
  if (t.includes("cancel")) return "cancel";
  if (t.includes("order") || t.includes("limit") || t.includes("stop")) return "order";
  return "neutral";
}

const TONES: Record<Tone, string> = {
  trade: "bg-primary/15 text-primary",
  deposit: "bg-[hsl(210_80%_55%)]/15 text-[hsl(210_80%_70%)]",
  withdraw: "bg-[var(--explorer-warning)]/15 text-[var(--explorer-warning)]",
  liquidation: "bg-destructive/15 text-destructive",
  cancel: "bg-muted text-muted-foreground",
  order: "bg-[hsl(260_60%_60%)]/15 text-[hsl(260_60%_75%)]",
  neutral: "bg-muted text-muted-foreground",
};

export function OpTypePill({ type, className }: Props) {
  const tone = classify(type);
  const label = (type ?? "UNKNOWN").toUpperCase().replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        TONES[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
