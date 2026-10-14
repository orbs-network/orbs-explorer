import { TokenDisplay } from "@/components/token-display";
import { TokenAmountFormatted } from "@/components/token-amount";
import type { Token } from "@/lib/types";

export function OrderPriceRate({
  rate,
  srcToken,
  chainId,
  dstToken,
}: {
  rate: string;
  srcToken?: Token;
  chainId?: number;
  dstToken?: Token;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="font-mono">1</span>
      <TokenDisplay address={srcToken?.address} chainId={chainId} />
      <span className="text-muted-foreground">=</span>
      <TokenAmountFormatted amount={rate} token={dstToken} chainId={chainId} />
    </div>
  );
}
