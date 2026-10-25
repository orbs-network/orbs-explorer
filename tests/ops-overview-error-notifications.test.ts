import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  reportOverviewErrors,
  type OverviewErrorNotice,
} from "../apps/ops/src/lib/overview-error-notifications";

const healthy = {
  isPending: false,
  isError: false,
  isFetching: false,
  errorUpdatedAt: 0,
  dataUpdatedAt: 100,
};
const failed = (errorUpdatedAt: number, dataUpdatedAt = 0) => ({
  ...healthy,
  isError: true,
  errorUpdatedAt,
  dataUpdatedAt,
});

function reporter() {
  const client = new QueryClient();
  const notices: OverviewErrorNotice[] = [];
  const dismissed: string[] = [];
  const report = (states: Parameters<typeof reportOverviewErrors>[1]) =>
    reportOverviewErrors(
      client,
      states,
      (notice) => notices.push(notice),
      (id) => dismissed.push(id),
    );
  return { notices, dismissed, report };
}

test("only settled query failures notify, including after automatic retries", () => {
  const { report, notices } = reporter();
  report({ orders: healthy, config: healthy });
  report({
    orders: { ...failed(200), isFetching: true },
    config: healthy,
  });
  assert.equal(notices.length, 0);
  report({ orders: failed(201), config: healthy });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, "Order history unavailable");
  assert.match(notices[0].description, /complete order counts/);
  assert.deepEqual(notices[0].queryKey, ["spotOrders", "overview"]);
});

test("shared observers and route remounts do not repeat a failure toast", () => {
  const { report, notices } = reporter();
  const states = { orders: failed(200, 100), config: healthy };
  report(states);
  report(states);
  report({ ...states, orders: { ...states.orders } });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, "Order refresh failed");
  assert.match(notices[0].description, /last successful snapshot/);
  report({ ...states, orders: failed(300, 100) });
  assert.equal(notices.length, 2, "a later failed refresh still notifies");
  assert.equal(
    notices[0].id,
    notices[1].id,
    "a new failure replaces the existing source toast",
  );
});

test("a history outage suppresses configuration noise until orders are available", () => {
  const { report, notices } = reporter();
  const config = failed(200);
  report({
    orders: { ...healthy, isPending: true, dataUpdatedAt: 0 },
    config,
  });
  assert.equal(notices.length, 0);
  report({ orders: failed(201), config });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, "Order history unavailable");
  report({ orders: healthy, config });
  assert.equal(notices.length, 2);
  assert.equal(notices[1].title, "Trading app details unavailable");
  assert.match(notices[1].description, /adapter checks may be incomplete/);
  assert.deepEqual(notices[1].queryKey, ["spotConfig", "partner-catalog"]);
});

test("configuration refresh preserves the last snapshot and recovery dismisses its toast", () => {
  const { report, notices, dismissed } = reporter();
  report({ orders: healthy, config: failed(200, 100) });
  assert.equal(notices[0].title, "Trading app configuration could not refresh");
  assert.match(notices[0].description, /last loaded app names/);
  report({ orders: healthy, config: { ...healthy, dataUpdatedAt: 300 } });
  assert.ok(dismissed.includes(notices[0].id));
});
