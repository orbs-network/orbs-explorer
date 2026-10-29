"use client";

import { useState, type ReactElement } from "react";
import { Copy } from "lucide-react";
import { useTheme } from "next-themes";
import type { ThemeObject } from "react-json-view";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { ClientReactJson } from "./client-json-view";
import { Button } from "./controls/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./controls/dialog";

// Base16 syntax colors use the same Orbs neutrals and accents as the app.
// The library needs literal colors to derive its expanders and guide lines.
const jsonThemes = {
  light: {
    base00: "#ffffff",
    base01: "#f6f6f6",
    base02: "#e2e2e2",
    base03: "#59595a",
    base04: "#59595a",
    base05: "#121214",
    base06: "#121214",
    base07: "#121214",
    base08: "#664344",
    base09: "#403263",
    base0A: "#49528c",
    base0B: "#017d86",
    base0C: "#017d86",
    base0D: "#3346f2",
    base0E: "#8b4590",
    base0F: "#664344",
  },
  dark: {
    base00: "#1e1e20",
    base01: "#29292b",
    base02: "#414142",
    base03: "#c5c5c5",
    base04: "#c5c5c5",
    base05: "#f6f6f6",
    base06: "#f6f6f6",
    base07: "#f6f6f6",
    base08: "#ffadae",
    base09: "#b99dee",
    base0A: "#cad0f6",
    base0B: "#2cedfc",
    base0C: "#67e9f4",
    base0D: "#95a1ed",
    base0E: "#dc8ae0",
    base0F: "#ffadae",
  },
} satisfies Record<"light" | "dark", ThemeObject>;

function JsonPreview({ data, title }: { data: object; title: string }) {
  const { resolvedTheme } = useTheme();
  const copy = useCopy();
  const [view, setView] = useState<{
    collapsed: boolean | number;
    version: number;
  }>({
    collapsed: 1,
    version: 0,
  });
  const reset = (collapsed: boolean) =>
    setView((previous) => ({ collapsed, version: previous.version + 1 }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => reset(false)}>
          Expand all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => reset(true)}>
          Collapse all
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => copy(JSON.stringify(data, null, 2))}
        >
          <Copy aria-hidden className="size-3.5" />
          Copy JSON
        </Button>
      </div>
      <div
        role="region"
        aria-label={`${title} JSON preview`}
        tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md bg-muted/40 p-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
      >
        <ClientReactJson
          key={view.version}
          src={data}
          theme={resolvedTheme === "dark" ? jsonThemes.dark : jsonThemes.light}
          collapsed={view.collapsed}
          enableClipboard={false}
          style={{
            backgroundColor: "transparent",
            fontFamily: "var(--font-orbs-mono), monospace",
            fontSize: 12,
            lineHeight: 1.7,
            overflowWrap: "anywhere",
          }}
        />
      </div>
    </>
  );
}

export function JsonPreviewDialog({
  data,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  data: object;
  title: string;
  description: string;
  children: ReactElement;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex h-[min(44rem,calc(100dvh-2rem))] min-h-0 flex-col overflow-hidden border-0 sm:max-w-4xl [&_[data-slot=dialog-close]]:top-2 [&_[data-slot=dialog-close]]:right-2 [&_[data-slot=dialog-close]]:grid [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:place-items-center">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && <JsonPreview data={data} title={title} />}
      </DialogContent>
    </Dialog>
  );
}
