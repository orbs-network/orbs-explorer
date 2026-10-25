import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_SAVED_OVERVIEW_VIEWS,
  canonicalOverviewQuery,
  overviewViewHref,
  overviewViewName,
  parseSavedOverviewViews,
  serializeSavedOverviewViews,
} from "../apps/ops/src/lib/overview-views";

const view = (index = 1) => ({
  id: `view-${index}`,
  name: `View ${index}`,
  query: "period=30&chain_id=137",
  createdAt: 1792584000000 + index,
});
const stored = (views: unknown[], version: unknown = 1) =>
  JSON.stringify({ version, views });

test("overview queries save only supported filters and display, with deterministic defaults and identities", () => {
  assert.equal(
    canonicalOverviewQuery(
      "period=30&chain_id=0137&chain_id=1&chain_id=137&partner_id=SushiSwap&partner_id=sushiswap&show_inactive_partners=1&overview_signal_view=rates&order_search=secret&source=v1&card_chain_sushiswap=1",
    ),
    "period=30&chain_id=1&chain_id=137&partner_id=sushiswap&show_inactive_partners=1&overview_signal_view=rates",
  );
  assert.equal(
    canonicalOverviewQuery(
      "period=7&overview_signal_view=activity&show_inactive_partners=0",
    ),
    "",
  );
  assert.equal(
    canonicalOverviewQuery(
      "period=invalid&chain_id=-1&chain_id=1.2&chain_id=Infinity&chain_id=9007199254740992&partner_id=%2F%2Fevil&overview_signal_view=bad",
    ),
    "",
  );
  for (const tab of ["rates", "review", "networks"])
    assert.equal(
      canonicalOverviewQuery(`overview_signal_view=${tab}`),
      `overview_signal_view=${tab}`,
    );
  assert.equal(
    canonicalOverviewQuery("period=all&chain_id=0&partner_id=adapter-0xabc"),
    "period=all&chain_id=0&partner_id=adapter-0xabc",
  );
});

test("saved views round-trip a versioned schema while normalizing names and queries", () => {
  const input = {
    ...view(),
    name: "  Polygon monitoring  ",
    query: "partner_id=sushiswap&period=30&order_view=payload",
  };
  const serialized = serializeSavedOverviewViews([input]);
  assert.equal(JSON.parse(serialized).version, 1);
  assert.deepEqual(parseSavedOverviewViews(serialized), [
    {
      ...input,
      name: "Polygon monitoring",
      query: "period=30&partner_id=sushiswap",
    },
  ]);
});

test("overview grouping and pulse are saved while retired comparison chart settings are discarded", () => {
  assert.equal(
    canonicalOverviewQuery(
      "overview_group=networks&overview_display=charts&app_chart_metric=failure-rate&pulse_window=168",
    ),
    "pulse_window=168&overview_group=networks",
  );
  assert.equal(
    canonicalOverviewQuery(
      "overview_group=apps&overview_display=table&app_chart_metric=outcomes",
    ),
    "",
  );
  assert.equal(
    canonicalOverviewQuery(
      "overview_group=invalid&overview_display=invalid&app_chart_metric=invalid",
    ),
    "",
  );
});

test("malformed storage and unknown versions never become saved views", () => {
  for (const raw of [
    null,
    "",
    "not json",
    "null",
    "[]",
    "42",
    "{}",
    stored([view()], 2),
    stored([view()], "1"),
    JSON.stringify({ version: 1, views: {} }),
    " ".repeat(100001),
  ]) {
    assert.deepEqual(parseSavedOverviewViews(raw), []);
  }
});

test("invalid individual records are omitted, duplicate ids keep first, and storage stays bounded", () => {
  const bad = [
    null,
    { ...view(90), id: "<script>" },
    { ...view(91), name: "bad\u0000name" },
    { ...view(92), createdAt: "123" },
    { ...view(93), createdAt: -1 },
    { ...view(94), createdAt: 1.5 },
    { ...view(95), query: "q".repeat(4097) },
  ];
  const parsed = parseSavedOverviewViews(
    stored([
      ...bad,
      view(),
      { ...view(), name: "Duplicate" },
      ...Array.from({ length: 20 }, (_, index) => view(index + 2)),
    ]),
  );
  assert.equal(parsed.length, MAX_SAVED_OVERVIEW_VIEWS);
  assert.equal(parsed[0].name, "View 1");
  assert.equal(
    new Set(parsed.map((item) => item.id)).size,
    MAX_SAVED_OVERVIEW_VIEWS,
  );
});

test("restoring a view always produces a local overview destination and strips unsafe or unrelated state", () => {
  for (const query of [
    "https://evil.example/?period=30",
    "//evil.example",
    "javascript:alert(1)",
    "next=https://evil.example&source=v1",
    "q".repeat(4097),
  ]) {
    assert.equal(overviewViewHref(query), "/");
  }
  assert.equal(
    overviewViewHref(
      "period=all&overview_signal_view=review&redirect=%2Forders",
    ),
    "/?period=all&overview_signal_view=review",
  );
});

test("view names support Unicode and reject empty, long, control and non-text values", () => {
  assert.equal(overviewViewName("  רשת Polygon 🔎  "), "רשת Polygon 🔎");
  for (const name of [
    "",
    "  ",
    "a".repeat(61),
    "Bad\nname",
    "Bad\u007fname",
    null,
    123,
    {},
  ])
    assert.equal(overviewViewName(name), undefined);
});
