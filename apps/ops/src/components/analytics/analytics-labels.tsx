"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@orbs/ui/controls/avatar";
import { Network } from "@orbs/ui/controls/network";
import { useToken } from "@orbs/domain/hooks/use-token";
import { shortenAddress } from "@orbs/domain/utils/utils";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { Copy } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import type { MarketToken } from "@/lib/market-analytics";

export function NetworkLabel({ chainId }: { chainId: number }) {
  return <Network chainId={chainId} variant="inline" showChainId={false} />;
}

export function TokenIdentity({ reference }: { reference: MarketToken }) {
  const { data } = useToken(
    reference.address,
    reference.chainId,
    Boolean(reference.token?.symbol),
  );
  const label =
    reference.token?.symbol ||
    data?.symbol ||
    (reference.address === "not-provided"
      ? "Token not provided"
      : "Unknown token");
  return (
    <span
      className="group/token inline-flex min-w-0 items-center gap-2"
      title={reference.address}
    >
      <Avatar aria-hidden className="size-6 shrink-0">
        <AvatarImage src={reference.token?.logoUrl || data?.logoUrl} alt="" />
        <AvatarFallback className="text-[9px]">
          {label === "Unknown token" ? "?" : label.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate font-medium">{label}</span>
        <span className="sr-only group-hover/token:not-sr-only group-focus-within/token:not-sr-only group-hover/token:block group-focus-within/token:block font-mono text-[11px] font-normal text-muted-foreground">
          {reference.address === "not-provided"
            ? "Address unavailable"
            : shortenAddress(reference.address)}
        </span>
      </span>
    </span>
  );
}

/** Use beside an inspection button, so no interactive controls are nested. */
export function TokenReferenceCopy({ reference }: { reference: MarketToken }) {
  const copy = useCopy();
  if (reference.address === "not-provided") return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
      aria-label={`Copy token ${shortenAddress(reference.address)} on chain ${reference.chainId}`}
      title={`Copy chain ${reference.chainId} and token address`}
      onClick={() =>
        copy(`Chain: ${reference.chainId}\nAddress: ${reference.address}`)
      }
    >
      <Copy aria-hidden className="size-3.5" />
    </Button>
  );
}

export const cellClass = "whitespace-nowrap px-3 py-3 text-left";
export const inspectClass =
  "rounded text-left tabular-nums transition-colors motion-reduce:transition-none enabled:hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground/60";
