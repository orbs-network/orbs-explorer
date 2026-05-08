import { cn } from "@/lib/utils/utils";

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
};

export function Mono({ className, children, ...rest }: Props) {
  return (
    <span
      className={cn("font-mono tabular-nums", className)}
      {...rest}
    >
      {children}
    </span>
  );
}

export function truncateHash(hash: string, head = 4, tail = 4): string {
  if (!hash) return "";
  if (hash.length <= head + tail + 2) return hash;
  return `${hash.slice(0, 2 + head)}…${hash.slice(-tail)}`;
}

export function formatId(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `#${n.toLocaleString()}`;
}
