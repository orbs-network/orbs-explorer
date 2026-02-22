import { useCopy } from "@/lib/hooks/use-copy";
import { useNetwork } from "@/lib/hooks/use-network";
import { cn } from "@/lib/utils";
import { isNumeric, shortenAddress } from "@/lib/utils/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { ExternalLink, Copy } from "lucide-react";
import { isHash } from "viem";

export function ExplorerLink({
  value: valueProp,
  chainId = 0,
  className,
  children,
}: {
  value?: string | number;
  chainId?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const value = valueProp?.toString();
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;
  const copy = useCopy();
  const type = isHash(value || "")
    ? "tx"
    : isNumeric(value || "")
      ? "block"
      : "address";

  const formattedValue =
    type === "block" ? value?.toString() : shortenAddress(value || "", 6);

  const content = (
    <div className="flex items-center gap-1">
      <a
        href={`${explorer}/${type}/${value}`}
        target="_blank"
        className={cn(
          "text-[13px]   hover:underline transition-colors",
          className,
        )}
      >
        {children || formattedValue}
      </a>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
    </div>
  );

  if (type === "tx" || type === "block") {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent
        className="flex flex-row gap-2 items-center"
        side="bottom"
      >
        {value}
        <Copy
          className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
          onClick={(e) => {
            e.preventDefault();
            copy(value || "");
          }}
        />
      </TooltipContent>
    </Tooltip>
  );
}
