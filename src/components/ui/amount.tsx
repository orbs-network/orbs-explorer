import { abbreviate } from "@/lib/utils/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { useCopy } from "@/lib/hooks/use-copy";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";
import { useFormatNumber } from "@/lib/hooks/use-number-format";

export const Amount = ({
  amount = "",
  className,
  suffix = "",
  prefix = "",
  decimalAmount = false,
}: {
  amount?: string;
  className?: string;
  suffix?: string;
  prefix?: string;
  decimalAmount?: boolean;
}) => {
  const copy = useCopy();
  const decimalAmountValue = useFormatNumber({value: amount, decimalScale: 5});

  const content =  <span className={cn("text-[13px] font-mono font-medium text-foreground cursor-default", className)}>
  {prefix}
  { decimalAmount ? decimalAmountValue : abbreviate(amount, 3) || "0"}
  {suffix}
</span>
  return !decimalAmount ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="flex flex-row gap-2 items-center"
      >
        <span className="text-[12px] font-mono">{amount || "0"}</span>
        <Copy
          className="w-3.5 h-3.5 cursor-pointer hover:text-primary transition-colors"
          onClick={() => copy(amount)}
        />
      </TooltipContent>
    </Tooltip>
  ) : (
    content
  );
};
