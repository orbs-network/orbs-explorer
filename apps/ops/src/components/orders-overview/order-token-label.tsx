"use client";
import { useToken } from "@orbs/domain/hooks/use-token";
import { hasTokenSymbol } from "@orbs/domain/token-metadata";
import type { Token } from "@orbs/domain/types";

/** Noninteractive so token names can safely appear inside an order link. */
export function OrderTokenLabel({
  address,
  chainId,
  token,
}: {
  address: string;
  chainId?: number;
  token?: Token;
}) {
  const embedded =
    token?.address?.toLowerCase() === address?.toLowerCase() &&
    hasTokenSymbol(token)
      ? token
      : undefined;
  const { data } = useToken(address, chainId, Boolean(embedded));
  return (
    <span className="min-w-0 truncate" title={address}>
      {embedded?.symbol || data?.symbol || "Unknown token"}
    </span>
  );
}
