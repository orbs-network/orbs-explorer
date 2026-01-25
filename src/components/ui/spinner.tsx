import { cn } from "@/lib/utils/utils";
import { Loader2 } from "lucide-react";

export const Spinner = ({
  className = "",
  size = 20,
}: {
  className?: string;
  size?: number;
}) => (
  <div className={cn("flex items-center justify-center", className)}>
    <Loader2
      className={cn("h-5 w-5 animate-spin text-muted-foreground", className)}
      size={size}
    />
  </div>
);
