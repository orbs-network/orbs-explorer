import { CheckCircle2, Clock, XCircle, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/utils";

type StatusConfig = {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  border: string;
};

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  success: {
    icon: CheckCircle2,
    label: "Success",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  during: {
    icon: Clock,
    label: "In Progress",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
};

const DEFAULT_CONFIG: StatusConfig = {
  icon: Clock,
  label: "Unknown",
  color: "text-muted-foreground",
  bg: "bg-muted/50",
  border: "border-muted",
};

function getStatusConfig(status?: string): StatusConfig {
  if (!status) return DEFAULT_CONFIG;
  return STATUS_CONFIGS[status] ?? { ...DEFAULT_CONFIG, label: status };
}

interface SwapStatusBadgeProps {
  swapStatus?: string;
  className?: string;
}

export function SwapStatusBadge({ swapStatus, className }: SwapStatusBadgeProps) {
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
}
