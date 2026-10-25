import type { ListOrder, SpotConfig } from "@orbs/domain/twap/types";
import { getTwapOrderChainId } from "@orbs/domain/twap/utils";
import {
  adapterKey,
  addressFormat,
  buildAdapterRegistry,
  isZeroAddress,
  matchAdapter,
  type AdapterMatch,
  type AdapterPartner,
  type AddressFormat,
} from "./adapter-registry";

export type AdapterComparison = AdapterMatch | "invalid";
export type AdapterInventoryRow = {
  key: string;
  chainId: number | undefined;
  address: string;
  format: AddressFormat;
  comparison: AdapterComparison;
  partners: AdapterPartner[];
  knownNetworks: number[];
  orders: ListOrder[];
};

/** Union configured adapters and observed records, using only supplied order scope. */
export function buildAdapterInventory(
  orders: ListOrder[],
  config: SpotConfig | null,
): AdapterInventoryRow[] {
  const registry = buildAdapterRegistry(config);
  const rows = new Map<string, AdapterInventoryRow>();
  const partners = new Map<string, Map<string, AdapterPartner>>();
  const ensure = (chainId: number | undefined, address: string) => {
    const key = adapterKey(chainId, address);
    const format = addressFormat(address);
    const existing = rows.get(key);
    if (existing) {
      // A valid configured spelling must not hide bad checksums in service rows.
      if (existing.format === "valid" && format !== "valid")
        existing.format = format;
      return existing;
    }
    const row: AdapterInventoryRow = {
      key,
      chainId,
      address,
      format,
      comparison: "unavailable",
      partners: [],
      knownNetworks: [],
      orders: [],
    };
    rows.set(key, row);
    return row;
  };
  for (const registration of registry.registrations) {
    const row = ensure(registration.chainId, registration.address);
    const identities =
      partners.get(row.key) ?? new Map<string, AdapterPartner>();
    if (!identities.has(registration.partner.id.toLowerCase()))
      identities.set(
        registration.partner.id.toLowerCase(),
        registration.partner,
      );
    partners.set(row.key, identities);
  }
  for (const order of orders) {
    const value = getTwapOrderChainId(order);
    const chainId =
      value !== undefined && Number.isSafeInteger(value) ? value : undefined;
    const address =
      typeof order.exchangeAdapter === "string" ? order.exchangeAdapter : "";
    ensure(chainId, address).orders.push(order);
  }
  for (const row of rows.values()) {
    const result = matchAdapter(row.address, row.chainId, registry);
    row.comparison =
      row.format !== "valid" || isZeroAddress(row.address)
        ? "invalid"
        : result.match;
    row.knownNetworks = result.knownNetworks;
    row.partners = [...(partners.get(row.key)?.values() ?? [])].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
  }
  return [...rows.values()].sort(
    (a, b) => b.orders.length - a.orders.length || a.key.localeCompare(b.key),
  );
}
