"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@orbs/ui/controls/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@orbs/ui/controls/dropdown-menu";

export function OrderSourceOptions({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          aria-label="Advanced order lookup options"
        >
          <Settings2 aria-hidden className="size-3.5" /> Advanced
          {value === "v1" || value === "v2" ? ` · ${value}` : ""}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Order service override</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={onChange}
          aria-label="Order lookup service"
        >
          <DropdownMenuRadioItem value="all">
            Automatic (both services)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="v2">
            Current service (v2)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="v1">
            Legacy service (v1)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
