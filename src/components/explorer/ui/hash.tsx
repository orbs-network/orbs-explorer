"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { truncateHash } from "./mono";

type Props = {
  value: string | undefined | null;
  /** Show full hash instead of truncating. */
  full?: boolean;
  /** Optional href — wraps the hash text in an anchor. Copy still works. */
  href?: string;
  external?: boolean;
  className?: string;
  hashClassName?: string;
};

export function Hash({
  value,
  full = false,
  href,
  external,
  className,
  hashClassName,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className={cn("font-mono text-muted-foreground", className)}>—</span>;
  }

  const display = full ? value : truncateHash(value);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore clipboard failures
    }
  };

  const text = (
    <span
      className={cn(
        "font-mono tabular-nums",
        full && "break-all",
        href && "text-primary hover:underline",
        hashClassName
      )}
    >
      {display}
    </span>
  );

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="min-w-0"
        >
          {text}
        </a>
      ) : (
        text
      )}
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy"}
        title={copied ? "Copied" : "Copy"}
        className="inline-grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3 text-[var(--explorer-success)]" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}
