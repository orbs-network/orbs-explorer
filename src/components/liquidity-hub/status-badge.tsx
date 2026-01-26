import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/utils";

const getStatusConfig = (swapStatus?: string) => {
  if (swapStatus === "success") {
    return {
      icon: CheckCircle2,
      label: "Success",
      color: "text-green-500",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
    };
  }
  if (swapStatus === "failed") {
    return {
      icon: XCircle,
      label: "Failed",
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    };
  }
  if (swapStatus === "during") {
    return {
      icon: Clock,
      label: "In Progress",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    };
  }
  return {
    icon: Clock,
    label: swapStatus || "Unknown",
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    border: "border-muted",
  };
};

export const SwapStatusBadge = ({
  swapStatus,
  className,
}: {
  swapStatus?: string;
  className?: string;
}) => {
  const config = getStatusConfig(swapStatus);
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium",
        config.bg,
        config.border,
        config.color,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  );
};
