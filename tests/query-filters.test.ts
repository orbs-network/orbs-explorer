import assert from "node:assert/strict";
import { test } from "node:test";
import { URL_QUERY_KEYS } from "../src/lib/consts";
import {
  filterQueryValue,
  splitFilterValues,
} from "../src/lib/query-filter-values";

test("single-value filters retain the scalar shape expected by the API", () => {
  for (const key of [
    URL_QUERY_KEYS.HASH,
    URL_QUERY_KEYS.STATUS,
    URL_QUERY_KEYS.CONTRACT,
    URL_QUERY_KEYS.POSITION_ITEM_TYPE,
  ]) {
    assert.equal(filterQueryValue(key, ["selected"]), "selected");
    assert.equal(filterQueryValue(key, []), undefined);
  }
});

test("list filters retain arrays even when only one option is selected", () => {
  for (const key of [
    URL_QUERY_KEYS.CHAIN_ID,
    URL_QUERY_KEYS.PARTNER_ID,
    URL_QUERY_KEYS.ORDER_STATUS,
    URL_QUERY_KEYS.ACTION_TYPE,
    URL_QUERY_KEYS.USER,
  ]) {
    assert.deepEqual(filterQueryValue(key, ["selected"]), ["selected"]);
    assert.deepEqual(filterQueryValue(key, ["one", "two", "one"]), [
      "one",
      "two",
    ]);
    assert.equal(filterQueryValue(key, []), undefined);
  }
});

test("pasted lists trim whitespace, discard blanks and duplicate values", () => {
  assert.deepEqual(splitFilterValues(" 0x123, 0x456\n0x123, ,\n "), [
    "0x123",
    "0x456",
  ]);
  assert.deepEqual(splitFilterValues(""), []);
});
