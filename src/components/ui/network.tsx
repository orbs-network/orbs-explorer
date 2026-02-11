import { useNetwork } from "@/lib/hooks/use-network";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { cn } from "@/lib/utils";
import { getChainLogo } from "@/lib/utils/utils";

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

export function Network({
  chainId,
  data,
  variant = "default",
  showChainId = true,
  className,
}: NetworkProps) {
  const networkFromHook = useNetwork(chainId || 0);
  const network = data || networkFromHook;

  if (!network) return null;

  if (variant === "inline") {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {network.name}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-row gap-1.5 items-center", className)}>
        <Avatar className="w-4 h-4 border border-border">
          <AvatarImage src={getChainLogo(network.id)} />
          <AvatarFallback className="text-[8px] bg-muted">
            {network.name?.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-foreground">
          {network.name}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-row gap-2 items-center px-2 py-1 bg-muted/50 rounded-md",
        className
      )}
    >
      <Avatar className="w-4 h-4 border border-border">
        <AvatarImage src={getChainLogo(network.id)} />
        <AvatarFallback className="text-[8px] bg-muted">
          {network.name?.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground">{network.name}</span>
      {showChainId && network.id && (
        <span className="text-xs text-muted-foreground font-mono">
          #{network.id}
        </span>
      )}
    </div>
  );
}
