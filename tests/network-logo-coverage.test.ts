import assert from "node:assert/strict";
import { test } from "node:test";
import { chainLogosByChainId } from "../packages/domain/src/chain";
import {
  getChainLogo,
  getChainName,
  getChains,
} from "../packages/domain/src/utils/utils";

test("every supported network has its own explicit logo", () => {
  const chains = getChains();
  assert.ok(chains.length > 0);
  for (const chain of chains) {
    assert.ok(chain.logoUrl, `${chain.name} (${chain.id}) needs a logo`);
    assert.equal(
      chain.logoUrl,
      chainLogosByChainId[chain.id as keyof typeof chainLogosByChainId],
    );
    assert.equal(new URL(chain.logoUrl).protocol, "https:");
  }
  assert.equal(
    new Set(chains.map((chain) => chain.logoUrl)).size,
    chains.length,
  );
});

test("production networks in the app configuration and service catalogs have logos", () => {
  // Observed in Spot config and both order-service catalogs on 2026-10-21.
  // 31337 is a local development network and uses the generic network fallback.
  const productionNetworkIds = [
    1, 10, 14, 30, 56, 130, 137, 143, 146, 196, 295, 999, 1329, 4326, 4663,
    5000, 8453, 9745, 42161, 43114, 57073, 59144, 80094, 81457, 747474,
  ];
  for (const id of productionNetworkIds) {
    const logo = chainLogosByChainId[id as keyof typeof chainLogosByChainId];
    assert.ok(logo, `Catalog network ${id} needs its own logo`);
    assert.equal(getChainLogo(id), logo);
  }
  assert.match(getChainLogo(295)!, /rsz_hedera\.jpg$/);
  assert.match(getChainLogo(4663)!, /rsz_robinhood-chain\.png$/);
  assert.equal(getChainName(4663), "Robinhood Chain");
  assert.equal(getChainName(1), "Ethereum");
  assert.equal(getChainName(987654321), undefined);
});
