"use client";
import { useToken } from "@orbs/domain/hooks/use-token";
import { hasTokenSymbol } from "@orbs/domain/token-metadata";
import type { Token } from "@orbs/domain/types";
import { InlineSkeleton } from "../loading-skeletons";

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
  const { data, isLoading } = useToken(address, chainId, Boolean(embedded));
  return (
    <span className="min-w-0 truncate" title={address}>
      {embedded?.symbol ||
        data?.symbol ||
        (isLoading ? (
          <InlineSkeleton label="Loading token name" className="w-16" />
        ) : (
          "Unknown token"
        ))}
    </span>
  );
}
