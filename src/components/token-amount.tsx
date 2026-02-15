import { useCopy } from "@/lib/hooks/use-copy";
import { useToUiAmount } from "@/lib/hooks/use-to-ui-amount";
import { useToWeiAmount } from "@/lib/hooks/use-to-wei-amount";
import { useToken } from "@/lib/hooks/use-token";
import { abbreviate } from "@/lib/utils/utils";
import { useMemo } from "react";
import BN from "bignumber.js";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Copy } from "lucide-react";
import { TokenAddress } from "./token-address";
import { usePriceUsd } from "@/lib/hooks/use-price-usd";
import { useFormatNumber } from "@/lib/hooks/use-number-format";

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
  const apiUsd = usePriceUsd(address, chainId).data;
  const copy = useCopy();

  const formattedAmount = useMemo(
    () => abbreviate(amountFormatted, 3),
    [amountFormatted],
  );


  const usdValue = useMemo(() => {
    return BN(apiUsd || 0).times(amountFormatted || 0).toString();
  }, [apiUsd, amountFormatted]);

  const usdF = useMemo(() => {
    return abbreviate(usdValue, 2);
  }, [usdValue]);

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
        <TooltipContent side="bottom" className="flex flex-row gap-2 items-center">
          <span className="text-sm font-mono">{amountRaw || "0"}</span>
          <Copy
            className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
            onClick={() => copy(amountRaw)}
          />
        </TooltipContent>
      </Tooltip>

      <TokenAddress address={address} chainId={chainId} />
      
      {usdF && (
        <span className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded">
        ${usdF}
      </span>
      )}
    </div>
  );
};
