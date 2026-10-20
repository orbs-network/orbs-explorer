import type { QueryClient } from "@tanstack/react-query";
import type { Token } from "./types";
import { getChain, isNativeAddress } from "./utils/utils";

export type TokenReference = { address?: string; chainId?: number };

export const tokenQueryKey = (address?: string, chainId?: number) =>
  ["useToken", address?.toLowerCase(), chainId] as const;

// Retry unavailable metadata on a later refresh, without starting a second
// request as soon as the preloaded order content mounts.
export const TOKEN_FAILURE_STALE_TIME = 60_000;
const TOKENS_PER_BATCH = 100;

export function hasTokenSymbol(token?: Token | null): boolean {
  return Boolean(token?.symbol.trim());
}

export function isValidTokenReference(
  reference: TokenReference,
): reference is { address: string; chainId: number } {
  return (
    /^0x[a-fA-F0-9]{40}$/.test(reference.address ?? "") &&
    Number.isSafeInteger(reference.chainId) &&
    (reference.chainId ?? 0) > 0
  );
}

function getLogoUrl(name?: string) {
  if (!name?.trim()) return undefined;
  const slug = name
    .toLowerCase()
    .replace(/usd₮0/g, "usdt0")
    .replace(/\(.*?\)/g, "")
    .replace(/\susd$/, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/^wrapped-bnb$/, "wbnb")
    .replace(/^usdc$/, "usd-coin");
  return slug
    ? `https://static.arkhamintelligence.com/tokens/${slug}.png`
    : undefined;
}

export async function fetchTokenBatch(
  addresses: string[],
  chainId: number,
  signal?: AbortSignal,
): Promise<Token[]> {
  signal?.throwIfAborted();
  const tokens: Token[] = [];
  const contracts: string[] = [];
  for (const address of new Set(
    addresses.map((value) => value.toLowerCase()),
  )) {
    if (!isValidTokenReference({ address, chainId })) continue;
    if (isNativeAddress(address)) {
      const native = getChain(chainId)?.nativeCurrency;
      if (native) tokens.push({ ...native, address });
    } else {
      contracts.push(address);
    }
  }
  if (!contracts.length) return tokens;

  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch("/api/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    body: JSON.stringify({ addresses: contracts, chainId }),
  });
  if (!response.ok)
    throw new Error(`Token metadata unavailable (${response.status})`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid token metadata response");
  const requested = new Set(contracts);
  for (const item of data) {
    if (
      !item ||
      typeof item.address !== "string" ||
      !requested.has(item.address.toLowerCase()) ||
      !Number.isInteger(item.decimals) ||
      item.decimals < 0 ||
      item.decimals > 255
    )
      continue;
    const name = typeof item.name === "string" ? item.name : undefined;
    tokens.push({
      address: item.address.toLowerCase(),
      decimals: item.decimals,
      symbol: typeof item.symbol === "string" ? item.symbol : "",
      name,
      logoUrl: getLogoUrl(name),
    });
  }
  return tokens;
}

export async function preloadTokenMetadata(
  queryClient: QueryClient,
  references: TokenReference[],
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const unique = new Map<string, { address: string; chainId: number }>();
  for (const reference of references) {
    if (!isValidTokenReference(reference)) continue;
    const address = reference.address.toLowerCase();
    unique.set(`${reference.chainId}:${address}`, {
      address,
      chainId: reference.chainId,
    });
  }
  const byChain = new Map<number, string[]>();
  for (const { address, chainId } of unique.values()) {
    const cached = queryClient.getQueryState<Token | null>(
      tokenQueryKey(address, chainId),
    );
    if (
      cached?.status === "success" &&
      !cached.isInvalidated &&
      (hasTokenSymbol(cached.data) ||
        Date.now() - cached.dataUpdatedAt < TOKEN_FAILURE_STALE_TIME)
    )
      continue;
    const addresses = byChain.get(chainId) ?? [];
    addresses.push(address);
    byChain.set(chainId, addresses);
  }
  const batches = [...byChain].flatMap(([chainId, addresses]) => {
    // Native symbols are local and remain available if this chain's RPC fails.
    const result = addresses
      .filter(isNativeAddress)
      .map((address) => ({ chainId, addresses: [address] }));
    const contracts = addresses.filter((address) => !isNativeAddress(address));
    for (let start = 0; start < contracts.length; start += TOKENS_PER_BATCH)
      result.push({
        chainId,
        addresses: contracts.slice(start, start + TOKENS_PER_BATCH),
      });
    return result;
  });
  const results = await Promise.allSettled(
    batches.map(({ chainId, addresses }) =>
      fetchTokenBatch(addresses, chainId, signal),
    ),
  );
  // Leaving a page cancels the entire preload; cancellation isn't a token failure.
  signal?.throwIfAborted();
  results.forEach((result, index) => {
    const { chainId, addresses } = batches[index];
    const tokens = new Map(
      (result.status === "fulfilled" ? result.value : []).map((token) => [
        token.address.toLowerCase(),
        token,
      ]),
    );
    for (const address of addresses) {
      // The API omits failed tokens. Match by address, never by response position.
      queryClient.setQueryData<Token | null>(
        tokenQueryKey(address, chainId),
        (previous) => {
          const next = tokens.get(address);
          // A partial response must not erase a concurrently resolved symbol.
          return hasTokenSymbol(previous) ? previous : next ?? previous ?? null;
        },
      );
    }
  });
}
