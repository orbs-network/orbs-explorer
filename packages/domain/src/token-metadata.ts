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

type MetadataOwner = { active: boolean };
type MetadataBatch = {
  controller: AbortController;
  entries: PendingMetadata[];
};
type PendingMetadata = {
  address: string;
  chainId: number;
  owners: Set<MetadataOwner>;
  promise: Promise<Token | null>;
  resolve: (token: Token | null) => void;
  batch?: MetadataBatch;
};
type MetadataQueue = {
  pending: Map<string, PendingMetadata>;
  scheduled: boolean;
};

// A scope preload and the token components it reveals can mount together. Share
// their work and collect same-tick lookups into one bounded request per network.
const metadataQueues = new WeakMap<QueryClient, MetadataQueue>();

function flushMetadataQueue(queue: MetadataQueue) {
  queue.scheduled = false;
  const byChain = new Map<number, PendingMetadata[]>();
  for (const [key, entry] of queue.pending) {
    if (entry.batch) continue;
    if (![...entry.owners].some((owner) => owner.active)) {
      queue.pending.delete(key);
      entry.resolve(null);
      continue;
    }
    const entries = byChain.get(entry.chainId) ?? [];
    entries.push(entry);
    byChain.set(entry.chainId, entries);
  }
  for (const [chainId, entries] of byChain) {
    const native = entries.filter((entry) => isNativeAddress(entry.address));
    const contracts = entries.filter(
      (entry) => !isNativeAddress(entry.address),
    );
    const groups = native.map((entry) => [entry]);
    for (let start = 0; start < contracts.length; start += TOKENS_PER_BATCH)
      groups.push(contracts.slice(start, start + TOKENS_PER_BATCH));
    for (const group of groups) {
      const batch: MetadataBatch = {
        controller: new AbortController(),
        entries: group,
      };
      for (const entry of group) entry.batch = batch;
      void fetchTokenBatch(
        group.map((entry) => entry.address),
        chainId,
        batch.controller.signal,
      )
        .catch(() => [])
        .then((tokens) => {
          const byAddress = new Map(
            tokens.map((token) => [token.address.toLowerCase(), token]),
          );
          for (const entry of group) {
            const key = `${entry.chainId}:${entry.address}`;
            if (queue.pending.get(key) === entry) queue.pending.delete(key);
            entry.resolve(byAddress.get(entry.address) ?? null);
          }
        });
    }
  }
}

function pendingMetadata(
  queryClient: QueryClient,
  address: string,
  chainId: number,
  owner: MetadataOwner,
): PendingMetadata {
  let queue = metadataQueues.get(queryClient);
  if (!queue) {
    queue = { pending: new Map(), scheduled: false };
    metadataQueues.set(queryClient, queue);
  }
  const key = `${chainId}:${address}`;
  let entry = queue.pending.get(key);
  // An abandoned batch may not have settled its rejected fetch yet.
  if (entry?.batch?.controller.signal.aborted) entry = undefined;
  if (!entry) {
    let resolve!: PendingMetadata["resolve"];
    entry = {
      address,
      chainId,
      owners: new Set(),
      promise: new Promise((settle) => {
        resolve = settle;
      }),
      resolve,
    };
    queue.pending.set(key, entry);
    if (!queue.scheduled) {
      queue.scheduled = true;
      const scheduledQueue = queue;
      queueMicrotask(() => flushMetadataQueue(scheduledQueue));
    }
  }
  entry.owners.add(owner);
  return entry;
}

export function hasTokenSymbol(token?: Token | null): boolean {
  return typeof token?.symbol === "string" && Boolean(token.symbol.trim());
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
  const owner: MetadataOwner = { active: true };
  const pending: PendingMetadata[] = [];
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
    pending.push(pendingMetadata(queryClient, address, chainId, owner));
  }
  let onAbort: (() => void) | undefined;
  const release = () => {
    owner.active = false;
    for (const entry of pending) {
      entry.owners.delete(owner);
      const batch = entry.batch;
      if (
        batch &&
        batch.entries.every((entry) =>
          [...entry.owners].every((owner) => !owner.active),
        )
      )
        batch.controller.abort();
    }
  };
  try {
    const settled = Promise.all(pending.map((entry) => entry.promise));
    const results = signal
      ? await Promise.race([
          settled,
          new Promise<never>((_resolve, reject) => {
            onAbort = () => {
              release();
              reject(signal.reason);
            };
            signal.addEventListener("abort", onAbort, { once: true });
            if (signal.aborted) onAbort();
          }),
        ])
      : await settled;
    // Leaving a page cancels the whole caller, without cancelling shared work
    // that another mounted consumer still needs or recording token failures.
    signal?.throwIfAborted();
    pending.forEach(({ address, chainId }, index) => {
      // The API omits failed tokens. Match by address, never by response position.
      queryClient.setQueryData<Token | null>(
        tokenQueryKey(address, chainId),
        (previous) => {
          const next = results[index];
          // A partial response must not erase a concurrently resolved symbol.
          return hasTokenSymbol(previous)
            ? previous
            : (next ?? previous ?? null);
        },
      );
    });
  } finally {
    if (onAbort) signal?.removeEventListener("abort", onAbort);
    release();
  }
}
