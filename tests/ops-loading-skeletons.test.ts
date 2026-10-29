import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Skeleton } from "../packages/ui/src/skeleton";
import { ChartPlot } from "../apps/ops/src/components/charts/chart-plot";
import {
  AnalyticsSkeleton,
  ChartSkeleton,
  ChartPlotSkeleton,
  FilterFieldsSkeleton,
  ServiceStatusSkeleton,
  EventListSkeleton,
  InlineSkeleton,
  OrderDetailSkeleton,
  OverviewSkeleton,
  PartnerOverviewSkeleton,
  TableSkeleton,
} from "../apps/ops/src/components/loading-skeletons";

Object.assign(globalThis, { React });

test("content skeletons announce one busy state and hide visual placeholders from assistive technology", () => {
  for (const Component of [
    AnalyticsSkeleton,
    ChartSkeleton,
    () => createElement(ChartPlotSkeleton, { label: "Loading chart" }),
    FilterFieldsSkeleton,
    () => createElement(ServiceStatusSkeleton, { label: "Checking service" }),
    EventListSkeleton,
    OrderDetailSkeleton,
    OverviewSkeleton,
    PartnerOverviewSkeleton,
    TableSkeleton,
  ]) {
    const markup = renderToStaticMarkup(createElement(Component));
    assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
    assert.match(markup, /aria-busy="true"/);
    assert.match(markup, /class="sr-only"/);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /data-slot="skeleton"/);
    assert.doesNotMatch(markup, /<button|<input|<a\s|tabindex=/i);
  }
});

test("table skeletons keep semantic table structure and contain their wide rows", () => {
  const markup = renderToStaticMarkup(
    createElement(TableSkeleton, { columns: 9, rows: 4 }),
  );
  assert.equal((markup.match(/<tr\b/g) ?? []).length, 5);
  assert.equal((markup.match(/<td\b/g) ?? []).length, 36);
  assert.match(markup, /overflow-x-auto/);
  assert.match(markup, /<thead/);
  assert.match(markup, /<tbody/);
});

test("charts keep a sized skeleton until the chart engine finishes rendering", () => {
  const markup = renderToStaticMarkup(
    createElement(ChartPlot, {
      option: {},
      label: "Order activity",
      height: 220,
      onSelect() {},
    }),
  );
  assert.match(markup, /aria-label="Loading chart: Order activity"/);
  assert.match(markup, /height:220px/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /data-chart-engine="echarts"/);
  assert.match(markup, /invisible/);
  assert.doesNotMatch(markup, /tabindex="0"/);
});

test("skeleton motion can be disabled and inline placeholders remain valid phrasing content", () => {
  const markup = renderToStaticMarkup(createElement(Skeleton));
  assert.match(markup, /motion-reduce:animate-none/);
  const inline = renderToStaticMarkup(
    createElement(InlineSkeleton, { label: "Loading token" }),
  );
  assert.match(inline, /aria-label="Loading token"/);
  assert.doesNotMatch(inline, /<div/);
});
