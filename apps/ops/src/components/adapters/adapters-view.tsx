"use client";

import { useId, useMemo, useState } from "react";
import { ChevronRight, Copy, Search, X } from "lucide-react";
import { getChainName, getPartner } from "@orbs/domain/utils/utils";
import { useCopy } from "@orbs/domain/hooks/use-copy";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import { Network } from "@orbs/ui/controls/network";
import { Partner } from "@orbs/ui/controls/partner";
import { useOperationsData } from "@/components/operations/operations-view";
import { ContinuousTable } from "@/components/operations/continuous-table";
import { EmptyState, Panel } from "@/components/operations/primitives";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";
import { ViewTabs } from "@/components/view-tabs";
import {
  buildAdapterInventory,
  type AdapterInventoryRow,
} from "@/lib/adapter-inventory";
import { AddressCheck } from "./address-check";
import {
  AdapterMatchBadge,
  adapterComparisonLabels,
} from "./adapter-match-badge";
import { addressFormat } from "@/lib/adapter-registry";

const reviewPriority = {
  invalid: 3,
  "other-network": 2,
  unknown: 2,
  unavailable: 1,
  catalog: 0,
  current: 0,
};
const networkName = (chainId?: number) =>
  chainId
    ? (getChainName(chainId) ?? `Network ${chainId}`)
    : "Network not provided";
const appName = (row: AdapterInventoryRow) =>
  row.partners.map((partner) => partner.name).join(", ");
const displayAddress = (row: AdapterInventoryRow) =>
  row.format === "missing" ? "" : row.address;

function AdapterAddresses() {
  const {
    orders,
    config,
    isConfigError,
    scope,
    selectedPartnerIds,
    inspectOrders,
  } = useOperationsData();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("orders");
  const searchId = useId();
  const copy = useCopy();
  const inventory = useMemo(
    () => buildAdapterInventory(orders, config),
    [orders, config],
  );
  const scoped = useMemo(() => {
    const apps = new Set(selectedPartnerIds.map((id) => id.toLowerCase()));
    return inventory.filter(
      (row) =>
        (!scope.chainIds.length ||
          scope.chainIds.includes(String(row.chainId ?? 0))) &&
        (!apps.size ||
          row.partners.some((partner) => apps.has(partner.id.toLowerCase())) ||
          ((row.orders.length > 0 || row.partners.length !== 1) &&
            apps.has(`adapter-${displayAddress(row).toLowerCase()}`))),
    );
  }, [inventory, scope.chainIds, selectedPartnerIds]);
  const matches = useMemo(() => {
    const search = query.trim().toLowerCase();
    return scoped
      .filter((row) =>
        `${appName(row)} ${row.partners.map((partner) => partner.id).join(" ")} ${displayAddress(row) || "Address not provided"} ${networkName(row.chainId)} ${row.chainId ?? ""} ${adapterComparisonLabels[row.comparison]}`
          .toLowerCase()
          .includes(search),
      )
      .sort((a, b) => {
        if (sort === "review") {
          const priority =
            reviewPriority[b.comparison] - reviewPriority[a.comparison];
          if (priority) return priority;
        }
        if (sort === "network")
          return (
            networkName(a.chainId).localeCompare(networkName(b.chainId)) ||
            appName(a).localeCompare(appName(b)) ||
            a.key.localeCompare(b.key)
          );
        if (sort === "app")
          return (
            appName(a).localeCompare(appName(b)) ||
            networkName(a.chainId).localeCompare(networkName(b.chainId)) ||
            a.key.localeCompare(b.key)
          );
        return (
          b.orders.length - a.orders.length ||
          appName(a).localeCompare(appName(b)) ||
          a.key.localeCompare(b.key)
        );
      });
  }, [scoped, query, sort]);
  return (
    <Panel
      title="Configured & observed addresses"
      description="Catalog entries and addresses found in orders, grouped by network."
    >
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-1.5">
          <label
            htmlFor={searchId}
            className="sr-only"
          >
            Search adapters
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
            />
            <Input
              id={searchId}
              name="adapter_search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="App, network, address, or catalog status…"
              className="h-10 pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear adapter search"
                className="absolute right-1 top-1 size-8"
                onClick={() => {
                  setQuery("");
                  document.getElementById(searchId)?.focus();
                }}
              >
                <X aria-hidden className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <InvestigationSelect
          label="Sort adapters by"
          hideLabel
          value={sort}
          onChange={setSort}
        >
          <InvestigationSelectItem value="orders">
            Most orders
          </InvestigationSelectItem>
          <InvestigationSelectItem value="review">
            Needs review first
          </InvestigationSelectItem>
          <InvestigationSelectItem value="app">
            Trading app A–Z
          </InvestigationSelectItem>
          <InvestigationSelectItem value="network">
            Network A–Z
          </InvestigationSelectItem>
        </InvestigationSelect>
      </div>
      <div className="mb-3 flex justify-end text-xs text-muted-foreground">
        <p role="status" className="shrink-0 tabular-nums">
          {matches.length.toLocaleString()}{" "}
          {matches.length === 1 ? "adapter" : "adapters"}
          {query.trim() ? ` of ${scoped.length.toLocaleString()}` : ""}
        </p>
      </div>
      {!matches.length ? (
        <EmptyState
          title={
            query.trim() ? "No matching adapters" : "No adapters in this view"
          }
          description={
            !config
              ? "The app catalog is unavailable and there are no matching order addresses. Refresh data or change the filters."
              : "Try another search, network, or trading app."
          }
        />
      ) : (
        <ContinuousTable
          label="Adapter addresses"
          items={matches}
          minWidth={1040}
          itemKey={(row) => row.key}
          header={
            <tr>
              <th scope="col">Trading app</th>
              <th scope="col">Network</th>
              <th scope="col">Adapter address</th>
              <th scope="col">Catalog match</th>
              <th scope="col" className="text-right">
                Orders in view
              </th>
            </tr>
          }
          rowContent={(row) => (
            <>
              <th scope="row">
                <div className="space-y-1.5">
                  {row.partners.length ? (
                    row.partners.map((partner) => (
                      <Partner
                        key={partner.id}
                        id={partner.id}
                        variant="compact"
                        data={{ ...getPartner(partner.id), name: partner.name }}
                      />
                    ))
                  ) : (
                    <span className="text-muted-foreground">
                      {config ? "Unrecognized app" : "App unavailable"}
                    </span>
                  )}
                </div>
              </th>
              <td>
                <Network
                  chainId={row.chainId}
                  variant="inline"
                  showChainId={false}
                />
              </td>
              <td>
                <span className="inline-flex items-center gap-2">
                  <code className="max-w-xs select-all break-all text-xs">
                    {displayAddress(row) || "Not provided"}
                  </code>
                  {displayAddress(row) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      aria-label={`Copy adapter ${row.address} on ${networkName(row.chainId)}`}
                      onClick={() => copy(row.address)}
                    >
                      <Copy aria-hidden className="size-3.5" />
                    </Button>
                  )}
                </span>
              </td>
              <td>
                <AdapterMatchBadge
                  comparison={row.comparison}
                  knownNetworks={row.knownNetworks}
                  cached={isConfigError && config !== null}
                />
                {row.format === "checksum" &&
                  addressFormat(row.address) === "valid" && (
                    <p className="mt-1.5 max-w-48 text-[11px] text-muted-foreground">
                      An order reported an invalid checksum. Inspect its orders.
                    </p>
                  )}
              </td>
              <td className="text-right">
                {row.orders.length ? (
                  <button
                    type="button"
                    aria-label={`Inspect ${row.orders.length} orders for adapter ${displayAddress(row) || "not provided"} on ${networkName(row.chainId)}`}
                    onClick={() =>
                      inspectOrders(
                        `${appName(row) || "Adapter"} · ${networkName(row.chainId)}`,
                        row.orders,
                        "Orders matching this adapter and network within the current page filters.",
                      )
                    }
                    className="inline-flex min-h-8 items-center justify-end gap-1 rounded px-2 font-medium tabular-nums text-link hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.orders.length.toLocaleString()}
                    <ChevronRight aria-hidden className="size-3" />
                  </button>
                ) : (
                  <span className="px-2 text-muted-foreground">0</span>
                )}
              </td>
            </>
          )}
        />
      )}
    </Panel>
  );
}

export function AdaptersView() {
  return (
    <ViewTabs
      label="Adapter views"
      param="adapter_view"
      tabs={[
        {
          value: "addresses",
          label: "Addresses",
          content: <AdapterAddresses />,
        },
        {
          value: "address",
          label: "Check an address",
          content: <AddressCheck />,
        },
      ]}
    />
  );
}
