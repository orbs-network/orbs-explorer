import { useMemo } from "react";
import { CheckCircle2, Clock, XCircle, PlayCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const OrderStatusBadge = ({
  totalTrades,
  filledTrades,
  status,
}: {
  totalTrades: number;
  filledTrades: number;
  status: string;
}) => {
  const config = useMemo(() => {
    const statusLower = status.toLowerCase().replace(/_/g, " ");
    if (statusLower.includes("completed") || statusLower.includes("filled")) {
      return {
        icon: CheckCircle2,
        color: "text-green-500",
        bg: "bg-green-500/10",
        border: "border-green-500/20",
      };
    }
    if (statusLower.includes("cancelled") || statusLower.includes("canceled")) {
      return {
        icon: XCircle,
        color: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
      };
    }
    if (statusLower.includes("expired")) {
      return {
        icon: Clock,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
      };
    }
    if (statusLower.includes("pending") || statusLower.includes("open")) {
      return {
        icon: PlayCircle,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
      };
    }
    return {
      icon: RefreshCw,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    };
  }, [status]);

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
        config.bg,
        config.border
      )}
    >
      <Icon className={cn("w-3 h-3", config.color)} />
      <span className={cn("capitalize", config.color)}>
        {status.replace(/_/g, " ").toLowerCase()}
      </span>
      <span className={cn("font-mono", config.color)}>
        {filledTrades}/{totalTrades}
      </span>
    </div>
  );
};
