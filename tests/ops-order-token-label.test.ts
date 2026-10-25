import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokenQueryKey } from "../packages/domain/src/token-metadata";
import type { Token } from "../packages/domain/src/types";
import { OrderTokenLabel } from "../apps/ops/src/components/orders-overview/order-token-label";

// The workspace keeps JSX for Next; tsx uses the classic runtime in this isolated Node test.
Object.assign(globalThis, { React });

const address = `0x${"a".repeat(40)}`;
function render(embedded?: Token, cached?: Token): string {
  const client = new QueryClient();
  if (cached) client.setQueryData(tokenQueryKey(address, 137), cached);
  try {
    const markup = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(OrderTokenLabel, {
          address,
          chainId: 137,
          token: embedded,
        }),
      ),
    );
    return markup;
  } finally {
    client.clear();
  }
}

test("order token labels accept embedded symbols only for the actual token address", () => {
  const actual = { address, symbol: "USDC", decimals: 6 };
  assert.match(render({ ...actual, address: address.toUpperCase() }), />USDC</);
  const mismatched = {
    ...actual,
    address: `0x${"b".repeat(40)}`,
    symbol: "WRONG",
  };
  assert.match(render(mismatched), />Unknown token</);
  assert.doesNotMatch(render(mismatched), /WRONG/);
  assert.match(render(mismatched, actual), />USDC</);
  assert.match(render({ ...actual, symbol: " " }, actual), />USDC</);
});
