import { useCopy } from "@/lib/hooks/use-copy";
import { useToUiAmount } from "@/lib/hooks/use-to-ui-amount";
import { useToWeiAmount } from "@/lib/hooks/use-to-wei-amount";
import { useToken, useTokenLogo } from "@/lib/hooks/use-token";
import { abbreviate } from "@/lib/utils/utils";
import { useMemo } from "react";
import BN from "bignumber.js";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Copy } from "lucide-react";
import { TokenAddress } from "./token-address";

export const TokenAmount = ({
  amountRaw = "",
  address,
  chainId,
  className,
  usd = "0",
}: {
  address?: string;
  chainId?: number;
  amountRaw?: string;
  className?: string;
  usd?: string | number;
}) => {
  const token = useToken(address, chainId).data;
  const amountFormatted = useToUiAmount(token?.decimals, amountRaw);
  const copy = useCopy();

  const formattedAmount = useMemo(
    () => abbreviate(amountFormatted, 3),
    [amountFormatted],
  );

  if (!token) {
    return <Skeleton className="w-[80px] h-[18px] rounded" />;
  }

  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm font-mono font-medium text-foreground cursor-default">
            {formattedAmount || "0"}
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex flex-row gap-2 items-center">
          <span className="text-sm font-mono">{amountRaw || "0"}</span>
          <Copy
            className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
            onClick={() => copy(amountRaw)}
          />
        </TooltipContent>
      </Tooltip>

      <TokenAddress address={address} chainId={chainId} />
      
      {usd && usd !== "0" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded">
              ${abbreviate(usd, 2) || "0"}
            </span>
          </TooltipTrigger>
          <TooltipContent className="flex flex-row gap-2 items-center">
            <span className="text-sm font-mono">${abbreviate(usd, 7) || "0"}</span>
            <Copy
              className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
              onClick={() => copy(usd.toString())}
            />
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
