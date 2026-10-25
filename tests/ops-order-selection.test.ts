import assert from "node:assert/strict";
import { test } from "node:test";
import type { ListOrder } from "../packages/domain/src/twap/types";
import {
  orderIdentity,
  selectionOrders,
} from "../apps/ops/src/lib/order-selection";
import { orderReasonSummary } from "../apps/ops/src/components/investigation/order-presentation";

const order = (source: "v1" | "v2", chainId: number, hash: string) =>
  ({ source, hash, order: { witness: { chainId } } }) as ListOrder;
test("order-set drilldowns preserve exact network and service membership without mutating history", () => {
  const a = order("v1", 1, "0xAB"),
    b = order("v2", 1, "0xAB"),
    c = order("v2", 56, "0xAB"),
    d = order("v2", 1, "0xCD");
  const history = [a, b, c, d];
  assert.deepEqual(
    selectionOrders(history, {
      label: "Selected cohort",
      keys: [orderIdentity(b), orderIdentity(c), orderIdentity(b)],
      snapshot: 123,
      origin: "/performance?period=7",
    }),
    [b, c],
  );
  assert.deepEqual(history, [a, b, c, d]);
  assert.equal(orderIdentity(b), orderIdentity(order("v2", 1, "0xab")));
  assert.deepEqual(
    selectionOrders(history, {
      label: "Missing",
      keys: ["v2:1:0xmissing"],
      snapshot: 123,
      origin: "/",
    }),
    [],
  );
});
test("row reasons distinguish normal price waiting from failures and preserve unknown explanations", () => {
  assert.equal(
    orderReasonSummary(
      "Price can't meet condition: expected 88.24, got 84.38 - 95.63%",
    ),
    "Waiting for target price",
  );
  assert.equal(
    orderReasonSummary(
      "Deadline reached - Trigger price not met: expected 88.24 got 84.38",
    ),
    "Expired before target price",
  );
  assert.equal(
    orderReasonSummary(
      "TakerError [sendTx] - Error: WMError - Execution reverted for an unknown reason.",
    ),
    "Transaction reverted",
  );
  assert.equal(
    orderReasonSummary("RPC Request failed."),
    "Network request failed",
  );
  assert.equal(orderReasonSummary("Cancelled by contract"), "Order cancelled");
  assert.equal(
    orderReasonSummary("A distinct service explanation"),
    "A distinct service explanation",
  );
});
