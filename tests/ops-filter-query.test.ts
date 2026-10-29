import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_INVESTIGATION_FILTERS } from "../apps/ops/src/lib/order-investigation";
import {
  readInvestigationFilters,
  investigationFilterQuery,
} from "../apps/ops/src/lib/investigation-filter-query";

test("order filter URLs retain zero bounds and all supported facets after reload", () => {
  const filters = {
    ...DEFAULT_INVESTIGATION_FILTERS,
    query: "0xabc sushi",
    adapter: `0x${"a".repeat(40)}`,
    token: `0x${"b".repeat(40)}`,
    swapper: `0x${"c".repeat(40)}`,
    status: "active" as const,
    type: "limit",
    source: "v2" as const,
    errors: "latest" as const,
    minUsd: "0",
    maxUsd: "100.25",
    sort: "value-desc" as const,
  };
  assert.deepEqual(
    readInvestigationFilters(investigationFilterQuery(filters)),
    filters,
  );
});
test("exact address filters remove incidental whitespace from shareable URLs", () => {
  const query = investigationFilterQuery({
    ...DEFAULT_INVESTIGATION_FILTERS,
    adapter: " 0xAbCd ",
    token: " 0xEf12 ",
    swapper: ` 0x${"a".repeat(40)} `,
  });
  assert.equal(query.order_adapter, "0xAbCd");
  assert.equal(query.order_token, "0xEf12");
  assert.equal(query.order_swapper, `0x${"a".repeat(40)}`);
  assert.equal(readInvestigationFilters(query).swapper, `0x${"a".repeat(40)}`);
  assert.equal(readInvestigationFilters(query).adapter, "0xAbCd");
  assert.equal(readInvestigationFilters(query).token, "0xEf12");
});
test("unsupported URL facets fall back to defaults while invalid numeric bounds remain visible for correction", () => {
  const filters = readInvestigationFilters({
    order_status: "attacker",
    order_source: "v3",
    order_errors: "nope",
    order_sort: "unknown",
    min_usd: "bad",
    max_usd: "-1",
  });
  assert.deepEqual(filters, {
    ...DEFAULT_INVESTIGATION_FILTERS,
    minUsd: "bad",
    maxUsd: "-1",
  });
});
test("clearing order facets removes their query parameters", () => {
  assert.ok(
    Object.values(
      investigationFilterQuery(DEFAULT_INVESTIGATION_FILTERS),
    ).every((value) => value === undefined),
  );
});
