import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pageIdentity,
  previousPageIndex,
} from "../apps/ops/src/lib/page-history";

test("Back skips order tab and source entries while retaining the original list entry", () => {
  const positions = {
    0: {
      href: "/orders?period=30&order_status=active&table_page_order_investigation_results=3",
      top: 820,
    },
    1: { href: "/orders/0xabc?source=v2", top: 0 },
    2: { href: "/orders/0xabc?source=v2&order_view=execution", top: 250 },
    3: { href: "/orders/0xabc?source=v1&order_view=addresses", top: 0 },
  };
  assert.equal(previousPageIndex(positions, 3, positions[3].href), 0);
  assert.equal(positions[0].top, 820);
  assert.match(positions[0].href, /table_page_order_investigation_results=3/);
});

test("different partner orders are separate pages, while their tabs share one identity", () => {
  const list = "/partners/kodiak?period=7&view=orders";
  const first = `${list}&order_hash=0xabc`;
  const second = `${list}&order_hash=0xdef`;
  assert.notEqual(pageIdentity(list), pageIdentity(first));
  assert.equal(
    pageIdentity(first),
    pageIdentity(`${first}&order_view=execution&source=v2`),
  );
  const positions = {
    0: { href: list, top: 400 },
    1: { href: first, top: 0 },
    2: { href: second, top: 0 },
  };
  assert.equal(
    previousPageIndex(positions, 2, `${second}&order_view=addresses`),
    1,
  );
  assert.equal(
    previousPageIndex(positions, 1, `${first}&order_view=execution`),
    0,
  );
});

test("direct entry with only inner tab history has no prior app page", () => {
  assert.equal(
    previousPageIndex(
      {
        0: { href: "/orders/0xabc", top: 0 },
        1: { href: "/orders/0xabc?order_view=execution", top: 200 },
      },
      1,
      "/orders/0xabc?order_view=execution",
    ),
    undefined,
  );
});

test("page history ignores forward entries and invalid destinations", () => {
  assert.equal(pageIdentity("https://example.com/orders"), undefined);
  assert.equal(pageIdentity("//example.com/orders"), undefined);
  assert.equal(pageIdentity("/\\example.com/orders"), undefined);
  const positions = {
    0: { href: "/orders?period=7", top: 0 },
    1: { href: "/orders/0xabc", top: 0 },
    2: { href: "//example.com/orders", top: 0 },
    4: { href: "/charts", top: 0 },
  };
  assert.equal(
    previousPageIndex(positions, 3, "/orders/0xabc?order_view=addresses"),
    0,
  );
});
