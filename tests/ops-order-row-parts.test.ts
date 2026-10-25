import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ListOrder } from "../packages/domain/src/twap/types";
import {
  OrderRowPair,
  OrderRowErrors,
  OrderRowStatus,
} from "../apps/ops/src/components/investigation/order-row-parts";

Object.assign(globalThis, { React });
const input = `0x${"a".repeat(40)}`;
const output = `0x${"b".repeat(40)}`;
const order = () =>
  ({
    hash: `0x${"c".repeat(64)}`,
    inputToken: input,
    outputToken: output,
    metadata: {
      status: "pending",
      chunkSummary: {
        error: 1,
        lastChunkStatus: "failed",
        lastChunkDescription: "TakerError reverted",
      },
    },
    order: { witness: { chainId: 4663 } },
  }) as ListOrder;

test("unresolved row tokens expose compact addresses with separate accessible copy controls", () => {
  const client = new QueryClient();
  try {
    const record = order();
    record.metadata.srcToken = {
      address: output,
      symbol: "WRONG",
      decimals: 18,
    };
    const markup = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(OrderRowPair, { order: record, resolveMetadata: false }),
      ),
    );
    assert.doesNotMatch(markup, /Unknown token|WRONG/);
    assert.match(markup, /aria-label="Copy input token address"/);
    assert.match(markup, /aria-label="Copy output token address"/);
    assert.match(markup, /metadata unavailable/);
    assert.match(markup, /0xaaaa/);
    assert.doesNotMatch(markup, /<a\b/);
  } finally {
    client.clear();
  }
});

test("current errors have an explicit state, semantic error tone, and singular/plural labels", () => {
  const record = order();
  const status = renderToStaticMarkup(
    createElement(OrderRowStatus, {
      order: record,
      href: `/orders/${record.hash}`,
    }),
  );
  assert.match(status, /Active · erroring/);
  assert.match(status, /text-destructive/);
  assert.match(status, /TakerError reverted/);
  assert.match(
    renderToStaticMarkup(createElement(OrderRowErrors, { order: record })),
    />1 error</,
  );
  record.metadata.chunkSummary.error = 2;
  assert.match(
    renderToStaticMarkup(createElement(OrderRowErrors, { order: record })),
    />2 errors</,
  );
});
