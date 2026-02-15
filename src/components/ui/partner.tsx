import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { cn } from "@/lib/utils";
import { usePartner } from "@/lib/hooks/use-partner";

type PartnerData = {
  name?: string;
  logo?: string;
};

type PartnerProps = {
  id?: string;
  data?: PartnerData;
  variant?: "default" | "compact" | "with-subtitle";
  subtitle?: string;
  className?: string;
};

export function Partner({
  id,
  data,
  variant = "default",
  subtitle,
  className,
}: PartnerProps) {
  const partnerFromHook = usePartner(id || "");
  const partner = data || partnerFromHook;

  if (!partner) return null;

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-row gap-1.5 items-center", className)}>
        <Avatar className="w-4 h-4 border border-border">
          <AvatarImage src={partner.logo} />
          <AvatarFallback className="text-[8px] bg-muted">
            {partner.name?.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm text-foreground">{partner.name}</span>
      </div>
    );
  }

  if (variant === "with-subtitle") {
    return (
      <div className={cn("flex flex-row gap-2 items-center", className)}>
        <Avatar className="w-5 h-5 border border-border">
          <AvatarImage src={partner.logo} />
          <AvatarFallback className="text-[8px] bg-muted">
            {partner.name?.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {partner.name || "Unknown"}
          </span>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
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
        <AvatarImage src={partner.logo} />
        <AvatarFallback className="text-[8px] bg-muted">
          {partner.name?.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground">{partner.name}</span>
    </div>
  );
}
