import { useCopy } from "@/lib/hooks/use-copy";
import { useNetwork } from "@/lib/hooks/use-network";
import { cn } from "@/lib/utils";
import { shortenAddress } from "@/lib/utils/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { ExternalLink, Copy } from "lucide-react";
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