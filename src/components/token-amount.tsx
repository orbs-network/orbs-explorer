import { useCopy } from "@/lib/hooks/use-copy";
import { useToUiAmount } from "@/lib/hooks/use-to-ui-amount";
import { useToken } from "@/lib/hooks/use-token";
import { abbreviate } from "@/lib/utils/utils";
import { useMemo } from "react";
import BN from "bignumber.js";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Copy } from "lucide-react";
import { TokenAddress } from "./token-address";
import type { Token } from "@/lib/types";
import { useToWeiAmount } from "@/lib/hooks/use-to-wei-amount";






export const TokenAmountFormatted = ({
  token,
  amount = '',
  chainId,
  className,
  usd,
}: {
  token?: Token;
  amount: string;
  chainId?: number;
  className?: string;
  usd?: string | number;
}) => {
  const copy = useCopy();
  const amountAbbrev = useMemo(() => abbreviate(amount, 3), [amount]);
  const usdF = useMemo(() => abbreviate(usd || 0, 2), [usd]);
  const amountRaw = useToWeiAmount(token?.decimals, amount);

  

  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-[12px] font-mono font-medium text-foreground cursor-default">
          {amountAbbrev || "0"}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex flex-row gap-2 items-center">
        <span className="text-[12px] font-mono">{amountRaw || "0"}</span>
        <Copy
          className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
          onClick={() => copy(amountRaw)}
        />
      </TooltipContent>
    </Tooltip>

    <TokenAddress address={token?.address} chainId={chainId} />
    
    {usd && (
      <span className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded">
      ${usdF}
    </span>
    )}
  </div>
  );
};


export const TokenAmount = ({
  amountRaw = "",
  address,
  chainId,
  className,
  usd,
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


  const usdF = useMemo(() => {
    return abbreviate(usd || 0, 2);
  }, [usd]);

  if (!token) {
    return <Skeleton className="w-[80px] h-[18px] rounded" />;
  }

  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-[12px] font-mono font-medium text-foreground cursor-default">
            {formattedAmount || "0"}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex flex-row gap-2 items-center">
          <span className="text-[12px] font-mono">{amountRaw || "0"}</span>
          <Copy
            className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
            onClick={() => copy(amountRaw)}
          />
        </TooltipContent>
      </Tooltip>

      <TokenAddress address={address} chainId={chainId} />
      
      {usd && (
        <span className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded">
        ${usdF}
      </span>
      )}
    </div>
  );
};