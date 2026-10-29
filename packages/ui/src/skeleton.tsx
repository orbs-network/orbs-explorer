import { cn } from "@orbs/domain/utils/utils";

export function Skeleton({
  className,
  as: Component = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "span" }) {
  return (
    <Component
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
