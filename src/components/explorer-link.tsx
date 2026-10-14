"use client";

import { useNetwork } from "@/lib/hooks/use-network";
import { cn } from "@/lib/utils";
import { isNumeric, shortenAddress } from "@/lib/utils/utils";
import { ExternalLink } from "lucide-react";
import { isHash } from "viem";
import { Copy } from "./ui/copy";

export function ExplorerLink({
  value: valueProp,
  chainId = 0,
  className,
  children,
}: {
  value?: string | number;
  chainId?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const value = valueProp?.toString();
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;
  if (!value)
    return <span className="text-xs text-muted-foreground">Not reported</span>;
  const type = isHash(value) ? "tx" : isNumeric(value) ? "block" : "address";
  const label = type === "block" ? value : shortenAddress(value, 6);
  if (!explorer) return <Copy text={label} value={value} tooltip={value} />;

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <a
        href={`${explorer}/${type}/${value}`}
        target="_blank"
        rel="noopener noreferrer"
        title={value}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 text-[13px] hover:underline",
          className,
        )}
      >
        {children || label}
        <ExternalLink
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </a>
      <Copy text="" value={value} />
    </span>
  );
}
