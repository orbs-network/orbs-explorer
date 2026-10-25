"use client";

import { Network as NetworkGlyph } from "lucide-react";
import { useNetwork } from "@orbs/domain/hooks/use-network";
import { cn, getChainLogo, getChainName } from "@orbs/domain/utils/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

type NetworkData = {
  name?: string;
  shortname?: string;
  logoUrl?: string;
  id?: number;
};

type NetworkProps = {
  chainId?: number;
  data?: NetworkData;
  variant?: "default" | "compact" | "inline";
  showChainId?: boolean;
  className?: string;
};

function networkName(chainId?: number, name?: string): string {
  return (
    name?.trim() ||
    getChainName(chainId) ||
    (chainId !== undefined && chainId > 0
      ? `Network ${chainId}`
      : "Network not provided")
  );
}

function NetworkAvatar({
  chainId,
  name,
  logoUrl,
  className,
  decorative = false,
}: {
  chainId?: number;
  name: string;
  logoUrl?: string;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <Avatar
      data-network-icon=""
      data-chain-id={chainId}
      title={name}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      className={cn("size-4 shrink-0 border border-border bg-muted", className)}
    >
      <AvatarImage src={logoUrl} alt="" className="object-contain" />
      <AvatarFallback className="bg-muted text-muted-foreground">
        <NetworkGlyph aria-hidden className="size-[70%]" />
      </AvatarFallback>
    </Avatar>
  );
}

export function NetworkIcon({
  chainId,
  name,
  className,
}: {
  chainId?: number;
  name?: string;
  className?: string;
}) {
  const network = useNetwork(chainId);
  return (
    <NetworkAvatar
      chainId={chainId}
      name={networkName(chainId, name || network?.name)}
      logoUrl={getChainLogo(chainId)}
      className={className}
    />
  );
}

export function Network({
  chainId,
  data,
  variant = "default",
  showChainId = true,
  className,
}: NetworkProps) {
  const id = data?.id ?? chainId;
  const network = useNetwork(id);
  const name = networkName(id, data?.name || data?.shortname || network?.name);
  const icon = (
    <NetworkAvatar
      chainId={id}
      name={name}
      logoUrl={data?.logoUrl || getChainLogo(id)}
      decorative
    />
  );

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 align-middle",
          className,
        )}
      >
        {icon}
        <span className="min-w-0 break-words">{name}</span>
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
        {icon}
        <span className="min-w-0 break-words text-sm text-foreground">
          {name}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md bg-muted/50 px-2 py-1",
        className,
      )}
    >
      {icon}
      <span className="min-w-0 break-words text-sm font-medium text-foreground">
        {name}
      </span>
      {showChainId && id !== undefined && (
        <span className="text-xs text-muted-foreground font-mono">#{id}</span>
      )}
    </div>
  );
}
