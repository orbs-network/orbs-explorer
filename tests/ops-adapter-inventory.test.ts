import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder, SpotConfig } from "../packages/domain/src/twap/types";
import { buildAdapterInventory } from "../apps/ops/src/lib/adapter-inventory";

const current = `0x${"a".repeat(40)}`;
const legacy = `0x${"b".repeat(40)}`;
const unused = `0x${"c".repeat(40)}`;
const unknown = `0x${"d".repeat(40)}`;
const zero = `0x${"0".repeat(40)}`;
const uppercase = (value: string) => `0x${value.slice(2).toUpperCase()}`;
const config = {
  137: {
    dex: {
      quick: { adapter: current },
      quickswap: { adapter: uppercase(current) },
      thena: { adapter: unused },
      zero: { adapter: zero },
      broken: { adapter: "broken" },
    },
    partnerAdapters: [
      { partnerId: "quick", partnerName: "QuickSwap (old)", adapter: legacy },
      {
        partnerId: "quickswap",
        partnerName: "QuickSwap",
        adapter: uppercase(legacy),
      },
      { partnerId: "quick", partnerName: "QuickSwap (old)", adapter: current },
    ],
  },
  8453: { dex: { thena: { adapter: unused } } },
} as unknown as SpotConfig;
const order = (address: string, chainId: number | undefined = 137) =>
  ({
    exchangeAdapter: address,
    order: { witness: { chainId } },
  }) as ListOrder;

test("one registry table unions current, historical, and observed adapters without repeating alias rows", () => {
  const first = order(current);
  const second = order(uppercase(current));
  const old = order(legacy);
  const unrecognized = order(unknown);
  const wrongNetwork = order(current, 8453);
  const missingNetwork = order(current, 0);
  const missingAddress = order("");
  const input = [
    first,
    second,
    old,
    unrecognized,
    wrongNetwork,
    missingNetwork,
    missingAddress,
  ];
  const rows = buildAdapterInventory(input, config);
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
  const registered = rows.find((row) => row.key === `137:${current}`)!;
  assert.equal(
    registered.address,
    current,
    "retain the first full configured spelling",
  );
  assert.equal(registered.comparison, "current");
  assert.deepEqual(registered.partners, [
    { id: "quickswap", name: "Quickswap" },
  ]);
  assert.deepEqual(registered.orders, [first, second]);
  assert.equal(
    registered.orders[0],
    first,
    "inspection receives the original order records",
  );
  const historical = rows.find((row) => row.key === `137:${legacy}`)!;
  assert.equal(historical.comparison, "catalog");
  assert.deepEqual(historical.partners, [
    { id: "quickswap", name: "Quickswap" },
  ]);
  assert.deepEqual(historical.orders, [old]);
  const configuredOnly = rows.find((row) => row.key === `8453:${unused}`)!;
  assert.equal(configuredOnly.comparison, "current");
  assert.deepEqual(configuredOnly.orders, []);
  assert.equal(
    rows.reduce((count, row) => count + row.orders.length, 0),
    input.length,
  );
});

test("addresses observed on another or missing network never inherit an app identity", () => {
  const rows = buildAdapterInventory(
    [order(current, 8453), order(current, 0)],
    config,
  );
  const wrong = rows.find((row) => row.key === `8453:${current}`)!;
  assert.equal(wrong.comparison, "other-network");
  assert.deepEqual(wrong.knownNetworks, [137]);
  assert.deepEqual(wrong.partners, []);
  const missing = rows.find((row) => row.chainId === undefined)!;
  assert.equal(missing.comparison, "unavailable");
  assert.deepEqual(missing.knownNetworks, [137]);
  assert.deepEqual(missing.partners, []);
});

test("invalid and zero configured addresses remain visible even without matching orders", () => {
  const rows = buildAdapterInventory([], config);
  const empty = rows.find((row) => row.address === zero)!;
  assert.equal(empty.comparison, "invalid");
  assert.deepEqual(empty.orders, []);
  const malformed = rows.find((row) => row.address === "broken")!;
  assert.equal(malformed.comparison, "invalid");
  assert.equal(malformed.format, "invalid");
  assert.deepEqual(malformed.partners, [{ id: "broken", name: "Broken" }]);
});

test("missing configuration preserves all observed records without inventing unknown matches", () => {
  const valid = order(unknown);
  const invalid = order("bad");
  const missing = order(current, 0);
  for (const unavailable of [null, {}]) {
    const rows = buildAdapterInventory([valid, invalid, missing], unavailable);
    assert.equal(rows.length, 3);
    assert.equal(
      rows.find((row) => row.address === unknown)!.comparison,
      "unavailable",
    );
    assert.equal(
      rows.find((row) => row.address === "bad")!.comparison,
      "invalid",
    );
    assert.ok(rows.every((row) => row.partners.length === 0));
    assert.equal(
      rows.reduce((count, row) => count + row.orders.length, 0),
      3,
    );
  }
});

test("bad observed checksum remains an issue when the address shares a valid registry row", () => {
  const configured = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
  const bad = "0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
  const scopedConfig = {
    137: { dex: { custom: { adapter: configured } } },
  } as unknown as SpotConfig;
  const record = order(bad);
  const rows = buildAdapterInventory([record], scopedConfig);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].address, configured);
  assert.equal(rows[0].format, "checksum");
  assert.equal(rows[0].comparison, "invalid");
  assert.deepEqual(rows[0].orders, [record]);
});

test("order counts use only the supplied scope while zero-order registered rows stay available", () => {
  const scoped = order(current);
  const rows = buildAdapterInventory([scoped], config);
  assert.equal(
    rows.find((row) => row.key === `137:${current}`)!.orders.length,
    1,
  );
  assert.equal(
    rows.find((row) => row.key === `137:${legacy}`)!.orders.length,
    0,
  );
  assert.equal(
    rows.find((row) => row.key === `137:${unused}`)!.orders.length,
    0,
  );
});
