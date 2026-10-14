"use client";
import { useToken } from "@/lib/hooks/use-token";
import { shortenAddress } from "@/lib/utils/utils";
import type { Token } from "@/lib/types";

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
  const { data } = useToken(address, chainId, Boolean(token?.symbol));
  return (
    <span className="min-w-0 truncate" title={address}>
      {token?.symbol || data?.symbol || shortenAddress(address)}
    </span>
  );
}
