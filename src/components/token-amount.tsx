import { useCopy } from "@/lib/hooks/use-copy";
import { useToUiAmount } from "@/lib/hooks/use-to-ui-amount";
import { useToken } from "@/lib/hooks/use-token";
import { abbreviate } from "@/lib/utils/utils";
import { useMemo } from "react";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Copy } from "lucide-react";
import { TokenDisplay } from "./token-display";
import type { Token } from "@/lib/types";
import { useToWeiAmount } from "@/lib/hooks/use-to-wei-amount";
import { Amount } from "./ui/amount";

export const TokenAmountFormatted = ({
  token,
  amount = "",
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

  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <Amount amount={amount} />

      <TokenDisplay address={token?.address} chainId={chainId} />

      {usd && (
        <Amount amount={usd.toString()} className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded" />
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



  if (!token) {
    return <Skeleton className="w-[80px] h-[18px] rounded" />;
  }

  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <Amount amount={amountFormatted} />
      <TokenDisplay address={address} chainId={chainId} />

      {usd && (
        <Amount amount={usd.toString()} className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded" />
      )}
    </div>
  );
};
