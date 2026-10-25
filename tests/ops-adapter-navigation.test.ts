import assert from "node:assert/strict";
import { test } from "node:test";
import { getLegacyAdapterRedirect } from "../apps/ops/src/lib/adapter-navigation";

test("old adapter views converge while preserving repeated filters", () => {
  for (const key of ["security_view", "data_view"] as const) {
    const href = getLegacyAdapterRedirect(
      {
        [key]: "adapters",
        period: "all",
        chain_id: ["1", "137"],
        partner_id: ["sushiswap", "thena"],
      },
      key,
    );
    const url = new URL(href!, "http://localhost");
    assert.equal(url.pathname, "/adapters");
    assert.deepEqual(url.searchParams.getAll("chain_id"), ["1", "137"]);
    assert.deepEqual(url.searchParams.getAll("partner_id"), [
      "sushiswap",
      "thena",
    ]);
    assert.equal(url.searchParams.get("period"), "all");
    assert.equal(url.searchParams.has(key), false);
  }
});

test("address-check bookmarks open the form and unrelated views stay in place", () => {
  assert.equal(
    getLegacyAdapterRedirect(
      { security_view: "address", period: "7" },
      "security_view",
    ),
    "/adapters?period=7&adapter_view=address",
  );
  assert.equal(
    getLegacyAdapterRedirect({ security_view: "activity" }, "security_view"),
    undefined,
  );
  assert.equal(
    getLegacyAdapterRedirect({ data_view: "fields" }, "data_view"),
    undefined,
  );
  assert.equal(getLegacyAdapterRedirect({}, "data_view"), undefined);
});
