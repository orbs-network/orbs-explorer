import { cn, shortenAddress } from "@/lib/utils/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Copy, ExternalLink } from "lucide-react";
import { useCopy } from "@/lib/hooks/use-copy";
import { useNetwork } from "@/lib/hooks/use-network";
import { useToken } from "@/lib/hooks/use-token";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { isHash } from "viem";

export function Address({
  address,
  chainId = 0,
  className,
  children,
}: {
  address?: string;
  chainId?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;
  const copy = useCopy();
  const type = isHash(address || "") ? "tx" : "address";

  if (type === "tx") {
    return (
      <div className="flex items-center gap-1">
        <a
          href={`${explorer}/${type}/${address}`}
          target="_blank"
          className={cn(
            "text-sm font-mono text-primary hover:text-primary/80 hover:underline transition-colors",
            className,
          )}
        >
          {children || shortenAddress(address || "", 6)}
        </a>
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={`${explorer}/${type}/${address}`}
          target="_blank"
          className={cn(
            "text-sm font-mono text-primary hover:text-primary/80 hover:underline transition-colors",
            className,
          )}
        >
          {children || shortenAddress(address || "", 6)}
        </a>
      </TooltipTrigger>
      <TooltipContent className="flex flex-row gap-2 items-center">
        {address}
        <Copy
          className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
          onClick={(e) => {
            e.preventDefault();
            copy(address || "");
          }}
        />
      </TooltipContent>
    </Tooltip>
  );
}

export const TokenAddress = ({
  chainId,
  address,
}: {
  chainId?: number;
  address?: string;
}) => {
  const token = useToken(address, chainId).data;
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;
  const copy = useCopy();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={`${explorer}/address/${address}`}
          target="_blank"
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-sm font-medium rounded hover:bg-primary/20 transition-colors"
        >
          {token?.symbol || "..."}
        </a>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1 items-start">
        <span className="text-sm font-mono">{token?.name || "..."}</span>
        <div className="flex flex-row gap-2 items-center">
        <span className="text-sm font-mono">{address}</span>
        <Copy
          className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
          onClick={(e) => {
            e.preventDefault();
            copy(address || "");
          }}
        />
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
