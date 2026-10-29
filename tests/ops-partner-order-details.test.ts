import assert from "node:assert/strict";
import { test } from "node:test";
import {
  orderDetailHref,
  type OrderNavigationScope,
} from "../apps/ops/src/lib/order-investigation";
import { partnerOrdersTabHref } from "../apps/ops/src/lib/partner-navigation";
import { orderHashSearchHref } from "../apps/ops/src/lib/order-quick-views";

const hash = `0x${"ab".repeat(32)}`;
const scope: OrderNavigationScope = {
  partnerId: "kodiak",
  period: "30",
  chainIds: ["80094", "4663"],
  partnerIds: ["kodiak"],
  query:
    "partner_id=thena&order_status=failed&order_sort=oldest&order_swapper=wallet&order_errors=any&order_set=chart-selection&table_page_order_investigation_results=2&table_size_order_investigation_results=25&order_view=execution&unrelated=drop",
};
const url = (href: string) => new URL(href, "https://ops.test");

test("partner order details stay in their workspace, retain list filters, and discard obsolete pagination", () => {
  const detail = url(orderDetailHref(hash, "v2", scope));
  assert.equal(detail.pathname, "/partners/kodiak");
  assert.equal(detail.searchParams.get("order_hash"), hash);
  assert.equal(detail.searchParams.get("view"), "orders");
  assert.equal(detail.searchParams.get("source"), "v2");
  assert.equal(detail.searchParams.get("period"), "30");
  assert.deepEqual(detail.searchParams.getAll("chain_id"), ["80094", "4663"]);
  for (const [key, value] of [
    ["order_status", "failed"],
    ["order_sort", "oldest"],
    ["order_swapper", "wallet"],
    ["order_errors", "any"],
    ["order_set", "chart-selection"],
  ])
    assert.equal(detail.searchParams.get(key), value);
  for (const key of [
    "partner_id",
    "unrelated",
    "order_view",
    "table_page_order_investigation_results",
    "table_size_order_investigation_results",
  ])
    assert.equal(detail.searchParams.has(key), false);
});

test("partner source switching and return links preserve the workspace without stale detail state", () => {
  const detail = url(orderDetailHref(hash, "v2", scope));
  detail.searchParams.set("order_view", "execution");
  const current = { ...scope, query: detail.searchParams.toString() };
  const changed = url(orderDetailHref(hash, "v1", current));
  assert.equal(changed.pathname, "/partners/kodiak");
  assert.deepEqual(changed.searchParams.getAll("source"), ["v1"]);
  const both = url(orderDetailHref(hash, undefined, current));
  assert.equal(both.searchParams.has("source"), false);
  const back = url(partnerOrdersTabHref("kodiak", current));
  assert.equal(back.pathname, "/partners/kodiak");
  assert.equal(back.searchParams.get("view"), "orders");
  assert.equal(back.searchParams.get("order_status"), "failed");
  assert.equal(
    back.searchParams.get("table_page_order_investigation_results"),
    null,
  );
  assert.equal(back.searchParams.get("order_set"), "chart-selection");
  for (const key of ["order_hash", "source", "order_view", "partner_id"])
    assert.equal(back.searchParams.has(key), false);
});

test("global app filters do not embed details, while partner hash lookup retains its context", () => {
  const global = url(
    orderDetailHref(hash, "v2", { ...scope, partnerId: undefined }),
  );
  assert.equal(global.pathname, `/orders/${hash}`);
  assert.equal(global.searchParams.get("partner_id"), "kodiak");
  assert.equal(global.searchParams.has("order_hash"), false);
  const lookup = url(
    orderHashSearchHref(hash, { ...scope, query: `order_search=${hash}` })!,
  );
  assert.equal(lookup.pathname, "/partners/kodiak");
  assert.equal(lookup.searchParams.get("order_hash"), hash);
  assert.equal(lookup.searchParams.has("order_search"), false);
  const custom = "Custom / Dex?external=1#hash";
  const encoded = url(orderDetailHref(hash, undefined, { partnerId: custom }));
  assert.equal(
    decodeURIComponent(encoded.pathname.slice("/partners/".length)),
    custom,
  );
  assert.equal(encoded.origin, "https://ops.test");
  assert.equal(encoded.hash, "");
});
