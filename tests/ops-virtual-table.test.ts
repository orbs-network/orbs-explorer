import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import * as React from "react";
import { createElement, type Context } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VirtualTable } from "../apps/ops/src/components/operations/virtual-table";

Object.assign(globalThis, { React });
const requireOps = createRequire(resolve("apps/ops/package.json"));
const { AppRouterContext } = requireOps(
  "next/dist/shared/lib/app-router-context.shared-runtime",
) as { AppRouterContext: Context<unknown> };

for (const count of [0, 1, 5, 11, 12]) {
  test(`a short order table renders only its ${count} available records`, () => {
    const items = Array.from({ length: count }, (_, index) => ({
      hash: `order-${index}`,
      source: "v2",
    }));
    const markup = renderToStaticMarkup(
      createElement(
        AppRouterContext.Provider,
        { value: { push() {} } },
        createElement(VirtualTable<(typeof items)[number]>, {
          label: "Partner orders",
          contextKey: "agent:period=7",
          items,
          columnCount: 1,
          itemKey: (item) => `${item.source}:${item.hash}`,
          rowHref: (item) => `/orders/${item.hash}`,
          header: createElement("tr", null, createElement("th", null, "Order")),
          rowContent: (item) => createElement("td", null, item.hash),
        }),
      ),
    );
    assert.equal((markup.match(/data-index="\d+"/g) ?? []).length, count);
    assert.match(markup, new RegExp(`aria-rowcount="${count + 1}"`));
    assert.doesNotMatch(markup, /undefined/);
  });
}

test("a large order table initially renders a small virtual window with logical row counts and native links", () => {
  const items = Array.from({ length: 2000 }, (_, index) => index);
  const markup = renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: { push() {} } },
      createElement(VirtualTable<number>, {
        label: "Orders",
        contextKey: "period=all",
        items,
        columnCount: 2,
        itemKey: String,
        rowHref: (item) => `/orders/${item}`,
        header: createElement(
          "tr",
          null,
          createElement("th", { scope: "col" }, "Order"),
          createElement("th", { scope: "col" }, "Status"),
        ),
        rowContent: (item) =>
          createElement(
            React.Fragment,
            null,
            createElement(
              "td",
              null,
              createElement("a", { href: `/orders/${item}` }, `Order ${item}`),
            ),
            createElement("td", null, "Active"),
          ),
      }),
    ),
  );
  const rendered = (markup.match(/data-index="\d+"/g) ?? []).length;
  assert.ok(
    rendered > 0 && rendered <= 12,
    `Expected a small initial window, got ${rendered}`,
  );
  assert.match(markup, /aria-rowcount="2001"/);
  assert.match(markup, /aria-colcount="2"/);
  assert.match(markup, /aria-rowindex="2"/);
  assert.match(markup, /href="\/orders\/0"/);
  assert.doesNotMatch(markup, /Order 1999|Rows per page|Previous|Next/);
});
