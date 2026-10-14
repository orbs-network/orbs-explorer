import { useToUiAmount } from "@/lib/hooks/use-to-ui-amount";
import { useToken } from "@/lib/hooks/use-token";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";
import { TokenDisplay } from "./token-display";
import type { Token } from "@/lib/types";
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
  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <Amount amount={amount} />

      <TokenDisplay address={token?.address} chainId={chainId} />

      {usd && (
        <Amount
          amount={usd.toString()}
          prefix="$"
          className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded"
        />
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
  const tokenQuery = useToken(address, chainId);
  const token = tokenQuery.data;
  const amountFormatted = useToUiAmount(token?.decimals, amountRaw);

  if (!amountRaw)
    return (
      <span className="text-xs text-muted-foreground">Amount not reported</span>
    );
  if (tokenQuery.isLoading)
    return <Skeleton className="w-[80px] h-[18px] rounded" />;
  if (!token || token.decimals === undefined) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={amountRaw ? `Raw token units: ${amountRaw}` : undefined}
      >
        Token amount unavailable
      </span>
    );
  }

  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <Amount amount={amountFormatted} />
      <TokenDisplay address={address} chainId={chainId} />

      {usd && (
        <Amount
          amount={usd.toString()}
          prefix="$"
          className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 bg-muted/50 rounded"
        />
      )}
    </div>
  );
};
