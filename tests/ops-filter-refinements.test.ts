import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FilterDrawer } from "../packages/ui/src/filter-drawer";

test("applied filter count groups multiple networks and apps without hiding their chips", () => {
  const badges = [
    { key: "network-1", category: "network", label: "Ethereum", onRemove() {} },
    {
      key: "network-137",
      category: "network",
      label: "Polygon",
      onRemove() {},
    },
    { key: "app-sushi", category: "app", label: "SushiSwap", onRemove() {} },
    { key: "app-kodiak", category: "app", label: "Kodiak", onRemove() {} },
  ];
  const html = renderToStaticMarkup(
    createElement(FilterDrawer, {
      value: {},
      clearValue: {},
      description: "Filters",
      badges,
      onApply() {},
      children: () => null,
    }),
  );
  assert.ok(html.includes('aria-label="Filters (2 active)"'));
  for (const badge of badges) assert.ok(html.includes(`Remove ${badge.label}`));
});
