"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import {
  isOrderHash,
  orderDetailHref,
  type OrderNavigationScope,
} from "@/lib/order-investigation";
import { useOrderScope } from "@/hooks/use-order-scope";

export function OrderLookup({
  initialHash = "",
  navigationScope,
  onNavigate,
}: {
  initialHash?: string;
  navigationScope?: OrderNavigationScope;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const queryScope = useOrderScope();
  const scope = navigationScope ?? queryScope;
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hash, setHash] = useState(initialHash);
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isOrderHash(hash)) {
          setInvalid(true);
          inputRef.current?.focus();
          return;
        }
        onNavigate?.();
        router.push(orderDetailHref(hash.trim(), undefined, scope));
      }}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor={id} className="block text-xs text-muted-foreground">
          Order ID
        </label>
        <Input
          id={id}
          ref={inputRef}
          name="order_hash"
          value={hash}
          onChange={(event) => {
            setHash(event.target.value);
            setInvalid(false);
          }}
          placeholder="Paste order ID (0x…)"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="font-mono focus-visible:outline-none!"
        />
        {invalid && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-xs text-destructive"
          >
            Enter a complete order ID: 0x followed by 64 hexadecimal characters.
          </p>
        )}
      </div>
      <Button type="submit" className="h-10 shrink-0">
        Find order
      </Button>
    </form>
  );
}
