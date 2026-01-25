import { useMemo } from "react";
import { CheckCircle2, Clock, XCircle, PlayCircle, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderStatus } from "@orbs-network/spot-ui";

const getStatusConfig = (status: OrderStatus) => {
  if (status === OrderStatus.Completed) {
    return {
      icon: CheckCircle2,
      label: "Completed",
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    };
  }
  if (status === OrderStatus.Canceled) {
    return {
      icon: XCircle,
      label: "Canceled",
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    };
  }
  if (status === OrderStatus.Expired) {
    return {
      icon: Clock,
      label: "Expired",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    };
  }

  if (status === OrderStatus.Open) {
    return {
      icon: PlayCircle,
      label: "In Progress",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    };
  }
  return {
    icon: RefreshCw,
    label: "Processing",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
  };
};

export const OrderStatusBadge = ({
  totalTrades,
  filledTrades,
  status,
  statusOnly = false,
}: {
  totalTrades?: number;
  filledTrades?: number;
  status: OrderStatus;
  statusOnly?: boolean;
}) => {
  const config = useMemo(() => getStatusConfig(status), [status]);
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
      <span className={config.color}>{config.label}</span>
      {!statusOnly && <span className={cn("font-mono", config.color)}>
        {filledTrades}/{totalTrades}
      </span>}
    </div>
  );
};
