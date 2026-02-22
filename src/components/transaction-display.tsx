"use client";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  InfoIcon,
  LucideIcon,
  XCircle,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "./ui/tooltip";
import { Card, CardContent, CardHeader } from "./ui/card";
import { useRouter } from "next/navigation";
import { Spinner } from "./ui/spinner";
import { useToken } from "@/lib/hooks/use-token";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { TokenDisplay } from "./token-display";

export const Row = ({
  label,
  children,
  tooltip,
  description,
  className,
  missingValue = false,
}: {
  label: string;
  children?: ReactNode;
  tooltip?: string;
  className?: string;
  description?: string;
  missingValue?: boolean;
}) => {
  return (
    <div
      className={
        "flex flex-col justify-between w-full border-b border-border/50 pb-3 pt-1 flex-wrap gap-2 md:flex-row md:items-center last:border-b-0 last:pb-0"
      }
    >
      <div className="text-xs font-medium text-muted-foreground uppercase flex flex-row gap-2 items-center">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row gap-2 items-center">
            {`${label}`}
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {description && (
            <span className="text-[11px] text-muted-foreground/70 font-normal lowercase">
              {description}
            </span>
          )}
        </div>
      </div>
      <div
        className={cn(
          "flex flex-row w-fit text-sm font-mono items-center md:ml-auto text-foreground",
          className,
        )}
      >
        {missingValue ? <span className="text-muted-foreground/50">-</span> : children}
      </div>
    </div>
  );
};

const TransactionDisplay = ({
  header,
  children,
  isLoading,
}: {
  header?: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
}) => {
  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm overflow-hidden">
      {header && (
        <CardHeader className="border-b border-border shrink-0">{header}</CardHeader>
      )}
      <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6 min-w-0">{children}</CardContent>
    </Card>
  );
};

const BackButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      className="group flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-foreground hover:border-primary/50 hover:bg-card/80 transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      <span className="text-sm font-medium">Back</span>
    </button>
  );
};

const Grid = ({ children }: { children: ReactNode }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{children}</div>
  );
};

const Container = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col gap-4 max-w-screen-lg mx-auto px-3 py-4 sm:px-4 sm:py-6 w-full min-w-0">
      {children}
    </div>
  );
};

const ContainerHeader = ({
  children,
  backHref,
  defaultBackHref,
}: {
  children?: ReactNode;
  /** Explicit back destination (e.g. when coming from overview) */
  backHref?: string;
  /** When no backHref and no history, navigate here instead of router.back() */
  defaultBackHref?: string;
}) => {
  const router = useRouter();

  const onBack = () => {
    if (backHref) router.push(backHref);
    else if (defaultBackHref) router.push(defaultBackHref);
    else router.back();
  };

  return (
    <div className="flex flex-row justify-between items-center w-full mb-2 gap-2 min-w-0">
      <BackButton onClick={onBack} />
      <div className="min-w-0 shrink">{children}</div>
    </div>
  );
};

// Loading state component
const Loading = ({ message = "Loading..." }: { message?: string }) => {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <Spinner size={32} className="text-primary" />
        <p className="text-muted-foreground text-sm">{message}</p>
      </CardContent>
    </Card>
  );
};

// Not found / Error state component
const NotFound = ({
  title = "Not Found",
  description = "The item you're looking for doesn't exist.",
  icon: Icon = FileText,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
}) => {
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Section Card with icon header
const SectionCard = ({
  children,
  title,
  icon: Icon,
  className,
}: {
  children: ReactNode;
  title: string;
  icon?: LucideIcon;
  className?: string;
}) => {
  return (
    <Card className={cn("border-border", className)}>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
      </CardContent>
    </Card>
  );
};

// Hero header with gradient background (for swap/order headers)
const Hero = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-border rounded-xl p-6 mb-2",
        className,
      )}
    >
      {children}
    </div>
  );
};

// Badge component
const Badge = ({
  children,
  icon: Icon,
  variant = "primary",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  variant?: "primary" | "muted";
}) => {
  const styles = {
    primary: "bg-primary/10 border-primary/20 text-primary",
    muted: "bg-muted border-border text-muted-foreground",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 rounded-full border",
        styles[variant],
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span className="text-xs font-medium">{children}</span>
    </div>
  );
};

// Token swap direction display
const SwapDirection = ({
  fromAddress,
  toAddress,
  chainId,
}: {
  fromAddress?: string;
  toAddress?: string;
  chainId?: number;
}) => {
  const fromToken = useToken(fromAddress, chainId).data;
  const toToken = useToken(toAddress, chainId).data;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 bg-card/50 rounded-lg px-4 py-3 border border-border min-w-[140px]">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground tracking-wide">
            From
          </span>
          <div className="flex items-center gap-2"> 

            <TokenDisplay address={fromAddress} chainId={chainId} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20">
        <ArrowRight className="w-5 h-5 text-primary" />
      </div>

      <div className="flex items-center gap-3 bg-card/50 rounded-lg px-4 py-3 border border-border min-w-[140px]">
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground tracking-wide">
            To
          </span>
          <div className="flex items-center gap-2">
          
            <TokenDisplay address={toAddress} chainId={chainId} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Progress bar component
const ProgressBar = ({
  progress,
  label = "Progress",
  showInline = false,
}: {
  progress: number;
  label?: string;
  showInline?: boolean;
}) => {
  if (showInline) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-lg font-bold text-foreground">{progress}%</span>
        </div>
        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-bold text-foreground">{progress}%</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// Timestamp display
const Timestamp = ({
  date,
  showRelative = true,
}: {
  date: string | number | Date;
  showRelative?: boolean;
}) => {
  const moment = require("moment");
  const formatted = moment(date).format("lll");
  const relative = moment(date).fromNow();

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="w-3.5 h-3.5" />
      <span>{formatted}</span>
      {showRelative && (
        <span className="text-muted-foreground/60">({relative})</span>
      )}
    </div>
  );
};

// Info box for highlighted content
const InfoBox = ({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error";
  className?: string;
}) => {
  const styles = {
    default: "bg-muted/30 border-border",
    success: "bg-green-500/5 border-green-500/20",
    warning: "bg-orange-500/5 border-orange-500/20",
    error: "bg-red-500/5 border-red-500/20",
  };

  return (
    <div className={cn("p-4 rounded-lg border", styles[variant], className)}>
      {children}
    </div>
  );
};

TransactionDisplay.SectionItem = Row;
TransactionDisplay.Grid = Grid;
TransactionDisplay.Container = Container;
TransactionDisplay.ContainerHeader = ContainerHeader;
TransactionDisplay.Loading = Loading;
TransactionDisplay.NotFound = NotFound;
TransactionDisplay.SectionCard = SectionCard;
TransactionDisplay.Hero = Hero;
TransactionDisplay.Badge = Badge;
TransactionDisplay.SwapDirection = SwapDirection;
TransactionDisplay.ProgressBar = ProgressBar;
TransactionDisplay.Timestamp = Timestamp;
TransactionDisplay.InfoBox = InfoBox;

export { TransactionDisplay };
