import { cn } from "@/lib/utils";

export const Progress = ({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) => {
  return (
    <div className={cn("w-full h-2 bg-slate-400/20 rounded-lg", className)}>
      <div
        className="h-full bg-primary rounded-lg"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};
