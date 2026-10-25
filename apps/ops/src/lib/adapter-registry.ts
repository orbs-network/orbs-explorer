import { isAddress } from "viem";
import { PARTNERS } from "@orbs/domain/partners";
import type { SpotConfig } from "@orbs/domain/twap/types";
import { getSpotPartnerIdentity } from "@orbs/domain/twap/partner-catalog";

export type AddressFormat = "valid" | "missing" | "invalid" | "checksum";
export type AdapterMatch =
  | "current"
  | "catalog"
  | "other-network"
  | "unknown"
  | "unavailable";
export type AdapterPartner = { id: string; name: string };
type AdapterRegistration = {
  chainId: number;
  address: string;
  partner: AdapterPartner;
  source: "current" | "catalog";
};
export type AdapterRegistry = {
  current: Map<string, Set<string>>;
  catalog: Map<string, Set<string>>;
  networks: Map<string, Set<number>>;
  registrations: AdapterRegistration[];
  available: boolean;
};

const knownPartnerIds = new Set<string>(PARTNERS.map((partner) => partner.id));

export function addressFormat(value: unknown): AddressFormat {
  if (typeof value !== "string" || !value.trim()) return "missing";
  if (!isAddress(value, { strict: false })) return "invalid";
  const body = value.slice(2);
  if (
    body !== body.toLowerCase() &&
    body !== body.toUpperCase() &&
    !isAddress(value)
  )
    return "checksum";
  return "valid";
}

export const isZeroAddress = (value: string): boolean =>
  /^0x0{40}$/i.test(value);

export function adapterKey(
  chainId: number | undefined,
  address: string,
): string {
  return `${chainId}:${address.trim().toLowerCase()}`;
}

/** Build once for a snapshot; retain invalid registrations for inventory review. */
export function buildAdapterRegistry(
  config: SpotConfig | null,
): AdapterRegistry {
  const registrations: AdapterRegistration[] = [];
  const current = new Map<string, Set<string>>();
  const catalog = new Map<string, Set<string>>();
  const networks = new Map<string, Set<number>>();
  const identities = new Map<
    string,
    ReturnType<typeof getSpotPartnerIdentity>
  >();
  const add = (
    chainId: number,
    address: string,
    partnerId: string,
    source: AdapterRegistration["source"],
    partnerName?: string,
  ) => {
    const alias = partnerId.trim().toLowerCase();
    let identity = identities.get(alias);
    if (!identity) {
      identity = getSpotPartnerIdentity(partnerId, config);
      identities.set(alias, identity);
    }
    const partner = {
      id: identity.partnerId,
      name: knownPartnerIds.has(identity.partnerId)
        ? identity.partnerName
        : partnerName?.trim() || identity.partnerName,
    };
    registrations.push({ chainId, address, partner, source });
    if (addressFormat(address) !== "valid" || isZeroAddress(address)) return;
    const normalized = address.toLowerCase();
    const key = adapterKey(chainId, normalized);
    const target = source === "current" ? current : catalog;
    const names = target.get(key) ?? new Set<string>();
    names.add(partner.name);
    target.set(key, names);
    const chains = networks.get(normalized) ?? new Set<number>();
    chains.add(chainId);
    networks.set(normalized, chains);
  };
  for (const [chain, chainConfig] of Object.entries(config ?? {})) {
    const chainId = Number(chain);
    if (!Number.isSafeInteger(chainId) || chainId <= 0 || !chainConfig)
      continue;
    for (const [partnerId, dex] of Object.entries(chainConfig.dex ?? {})) {
      if (!dex || typeof dex !== "object") continue;
      add(
        chainId,
        typeof dex.adapter === "string" ? dex.adapter : "",
        partnerId,
        "current",
      );
    }
    for (const partner of chainConfig.partnerAdapters ?? [])
      add(
        chainId,
        typeof partner.adapter === "string" ? partner.adapter : "",
        partner.partnerId,
        "catalog",
        partner.partnerName,
      );
  }
  return {
    current,
    catalog,
    networks,
    registrations,
    available: config !== null && current.size + catalog.size > 0,
  };
}

export function matchAdapter(
  address: string,
  chainId: number | undefined,
  registry: AdapterRegistry,
): { match: AdapterMatch; names: string[]; knownNetworks: number[] } {
  const normalized = address.trim().toLowerCase();
  const key = adapterKey(chainId, normalized);
  const knownNetworks = [...(registry.networks.get(normalized) ?? [])].sort(
    (a, b) => a - b,
  );
  const match: AdapterMatch =
    !registry.available || !chainId
      ? "unavailable"
      : registry.current.has(key)
        ? "current"
        : registry.catalog.has(key)
          ? "catalog"
          : knownNetworks.length
            ? "other-network"
            : "unknown";
  return {
    match,
    names: [...(registry.current.get(key) ?? registry.catalog.get(key) ?? [])],
    knownNetworks,
  };
}
