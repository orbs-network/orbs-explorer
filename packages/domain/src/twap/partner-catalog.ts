import { PARTNERS } from "../partners";
import type { SpotConfig, SpotPartnerAdapter } from "./types";

export type SpotPartnerIdentity = Pick<
  SpotPartnerAdapter,
  "partnerId" | "partnerName"
>;

export interface SpotPartnerCatalogEntry extends SpotPartnerAdapter {
  chainId: number;
}

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const partnerAliases = new Map(
  PARTNERS.flatMap((partner) =>
    [partner.id, partner.name, ...partner.identifiers].map(
      (alias) => [alias.toLowerCase(), partner] as const,
    ),
  ),
);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Resolve service display names and legacy deployment suffixes to one app. */
export function getSpotPartnerIdentity(
  value: string,
  config?: SpotConfig | null,
): SpotPartnerIdentity {
  const name = value.trim().replace(/-old-\d+$/i, "");
  const normalized = name.toLowerCase();
  const registered = partnerAliases.get(normalized);
  if (registered)
    return { partnerId: registered.id, partnerName: registered.name };
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  for (const chain of Object.values(config ?? {})) {
    const customId = Object.keys(chain.dex ?? {}).find(
      (id) => id.toLowerCase() === normalized,
    );
    if (customId) return { partnerId: customId, partnerName: displayName };
  }
  return { partnerId: normalized, partnerName: displayName };
}

/** Validate the public status catalog rather than accepting arbitrary JSON as data. */
export function parseSpotPartnerCatalog(
  value: unknown,
): SpotPartnerCatalogEntry[] {
  if (!isRecord(value) || !Array.isArray(value.chains) || !value.chains.length)
    throw new Error("Invalid app identity catalog");
  const entries: SpotPartnerCatalogEntry[] = [];
  for (const chain of value.chains) {
    if (
      !isRecord(chain) ||
      typeof chain.chainId !== "number" ||
      !Number.isSafeInteger(chain.chainId) ||
      chain.chainId <= 0 ||
      !Array.isArray(chain.exchanges)
    )
      throw new Error("Invalid app identity catalog");
    for (const exchange of chain.exchanges) {
      if (
        !isRecord(exchange) ||
        typeof exchange.name !== "string" ||
        !exchange.name.trim() ||
        typeof exchange.address !== "string" ||
        !addressPattern.test(exchange.address)
      )
        throw new Error("Invalid app identity catalog");
      const identity = getSpotPartnerIdentity(exchange.name);
      if (!identity.partnerId) throw new Error("Invalid app identity catalog");
      entries.push({
        chainId: chain.chainId,
        ...identity,
        adapter: exchange.address,
      });
    }
  }
  if (!entries.length) throw new Error("Invalid app identity catalog");
  return entries;
}

/** Keep protocol settings intact while expanding universal app defaults per network. */
export function parseSpotConfig(value: unknown): SpotConfig {
  if (!isRecord(value) || !isRecord(value["*"]))
    throw new Error("Invalid Spot configuration");
  for (const [chainId, chain] of Object.entries(value)) {
    if (
      (chainId !== "*" &&
        (!Number.isSafeInteger(Number(chainId)) || Number(chainId) <= 0)) ||
      !isRecord(chain) ||
      (chain.dex !== undefined && !isRecord(chain.dex))
    )
      throw new Error("Invalid Spot configuration");
    if (isRecord(chain.dex)) {
      for (const dex of Object.values(chain.dex)) {
        if (
          !isRecord(dex) ||
          typeof dex.adapter !== "string" ||
          !addressPattern.test(dex.adapter) ||
          typeof dex.type !== "string" ||
          typeof dex.fee !== "string"
        )
          throw new Error("Invalid Spot configuration");
      }
    }
  }
  const config = value as SpotConfig;
  const sharedDexes = config["*"]?.dex;
  return Object.fromEntries(
    Object.entries(config).map(([chainId, chain]) => [
      chainId,
      chainId === "*"
        ? chain
        : { ...chain, dex: { ...sharedDexes, ...chain.dex } },
    ]),
  );
}

/** Add historical identities without fabricating protocol adapter configurations. */
export function mergeSpotPartnerCatalogs(
  config: SpotConfig | null,
  catalogs: readonly (readonly SpotPartnerCatalogEntry[])[],
): SpotConfig {
  const result: SpotConfig = Object.fromEntries(
    Object.entries(config ?? {}).map(([chainId, chain]) => [
      chainId,
      {
        ...chain,
        ...(chain.partnerAdapters && {
          partnerAdapters: [...chain.partnerAdapters],
        }),
      },
    ]),
  );
  const candidates = new Map<string, Map<string, SpotPartnerCatalogEntry>>();
  for (const catalog of catalogs) {
    for (const entry of catalog) {
      const chainKey = String(entry.chainId);
      const chain = (result[chainKey] ??= {
        dex: config?.["*"]?.dex ? { ...config["*"].dex } : undefined,
      });
      const adapter = entry.adapter.toLowerCase();
      // Exact current configuration is authoritative over a service's historical alias.
      if (
        Object.values(chain.dex ?? {}).some(
          (dex) => dex.adapter.toLowerCase() === adapter,
        )
      )
        continue;
      const identity = getSpotPartnerIdentity(entry.partnerName, config);
      const key = `${chainKey}:${adapter}`;
      const identities = candidates.get(key) ?? new Map();
      if (!identities.has(identity.partnerId.toLowerCase()))
        identities.set(identity.partnerId.toLowerCase(), {
          ...entry,
          ...identity,
        });
      candidates.set(key, identities);
    }
  }
  for (const identities of candidates.values()) {
    // One chain/address can appear under two apps in historical catalogs. Do not guess.
    if (identities.size !== 1) continue;
    const entry = identities.values().next().value;
    if (!entry) continue;
    const { chainId, ...identity } = entry;
    (result[String(chainId)].partnerAdapters ??= []).push(identity);
  }
  return result;
}
