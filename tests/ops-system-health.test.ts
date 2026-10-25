import assert from "node:assert/strict";
import { test } from "node:test";
import axios, { AxiosError } from "axios";
import { QueryClient } from "@tanstack/react-query";
import {
  CURRENT_SINK_API_URL,
  getSpotConfig,
  SINK_API_URLS,
  SPOT_CONFIG_URL,
} from "../packages/domain/src/twap/api";
import {
  getServiceStatus,
  serviceStatusQueryOptions,
  ServiceStatusError,
} from "../packages/domain/src/twap/service-status";
import {
  assessSystemHealth,
  HEALTH_REPORT_MAX_AGE_MS,
  parseSystemHealth,
  summarizeHealthCoverage,
  summarizeSystemCoverage,
  serviceOrdersHref,
  buildServiceOrderImpact,
} from "../apps/ops/src/lib/system-health";
import type { ListOrder } from "../packages/domain/src/twap/types";
import { investigateOrders } from "../apps/ops/src/lib/order-investigation";
import { readInvestigationFilters } from "../apps/ops/src/lib/investigation-filter-query";

const now = Date.parse("2026-10-21T12:00:00Z");
const iso = (age = 0) => new Date(now - age).toISOString();
function report(payload: Record<string, unknown>) {
  return parseSystemHealth({
    payload: { timestamp: iso(), ...payload },
    checkedAt: now,
    latencyMs: 75,
  });
}
const listener = (extra: Record<string, unknown> = {}) => ({
  chainId: 1,
  chainName: "ethereum",
  listenerActive: true,
  eventsFetchingEnabled: true,
  lastBlock: 1_000,
  updatedAt: iso(2_000),
  ...extra,
});
const taker = (extra: Record<string, unknown> = {}) => ({
  serverId: "server-1",
  averageIntervalMs: 5_000,
  lastFetchAt: iso(1_000),
  secondsSinceLastFetch: 1,
  ...extra,
});

test("actual status arrays preserve active listeners, disabled chains and taker heartbeat", () => {
  const parsed = report({
    version: "trigger-v1.4.0",
    blockFetchStatus: [
      listener(),
      listener({
        chainId: 295,
        chainName: "hemi",
        listenerActive: false,
        eventsFetchingEnabled: false,
        updatedAt: undefined,
        lastBlock: 0,
      }),
    ],
    takerFetchStats: [taker()],
  });
  const assessed = assessSystemHealth(parsed, now);
  assert.equal(parsed.version, "trigger-v1.4.0");
  assert.deepEqual(
    assessed.listeners.map((row) => row.state),
    ["active", "disabled"],
  );
  assert.equal(assessed.listeners[1].lastBlock, 0);
  assert.equal(assessed.takers[0].state, "active");
  assert.equal(assessed.takers[0].overdueAfterMs, 60_000);
  assert.equal(assessed.issueCount, 0);
  assert.equal(assessed.disabledCount, 1);
  assert.equal(assessed.unknownCount, 0);
});

test("catalog presence and the original service's omitted listeners never imply active signals", () => {
  const parsed = report({
    chains: [
      { chainId: 1, chainName: "ethereum" },
      { chainId: 137, chainName: "polygon" },
    ],
    takerFetchStats: [taker()],
  });
  const assessed = assessSystemHealth(parsed, now);
  assert.equal(parsed.listenerCoverage, "unreported");
  assert.deepEqual(
    assessed.listeners.map((row) => row.state),
    ["unknown", "unknown"],
  );
  assert.equal(assessed.issueCount, 0);
  assert.equal(assessed.unknownCount, 2);
});

test("reported chain rows merge catalog identities without losing unreported networks", () => {
  const parsed = report({
    chains: [
      { chainId: 1, chainName: "ethereum" },
      { chainId: 137, chainName: "polygon" },
    ],
    blockFetchStatus: [listener({ chainName: undefined })],
  });
  assert.equal(parsed.listeners.length, 2);
  assert.equal(parsed.listeners[0].chainName, "ethereum");
  assert.deepEqual(
    assessSystemHealth(parsed, now).listeners.map((row) => row.state),
    ["active", "unknown"],
  );
});

test("inactive, overdue and missing flags stay distinct from explicitly disabled", () => {
  const parsed = report({
    blockFetchStatus: [
      listener({ listenerActive: false }),
      listener({ chainId: 10, updatedAt: iso(HEALTH_REPORT_MAX_AGE_MS + 1) }),
      listener({ chainId: 137, eventsFetchingEnabled: "true" }),
      listener({
        chainId: 295,
        listenerActive: false,
        eventsFetchingEnabled: false,
      }),
    ],
    takerFetchStats: [taker()],
  });
  const assessed = assessSystemHealth(parsed, now);
  assert.deepEqual(
    assessed.listeners.map((row) => row.state),
    ["inactive", "overdue", "unknown", "disabled"],
  );
  assert.equal(assessed.issueCount, 2);
});

test("malformed/null reports and empty heartbeat arrays remain unknown coverage", () => {
  for (const payload of [
    {},
    { blockFetchStatus: null, takerFetchStats: null },
    { blockFetchStatus: {}, takerFetchStats: "bad" },
    { blockFetchStatus: [], takerFetchStats: [] },
  ]) {
    const assessed = assessSystemHealth(report(payload), now);
    assert.equal(assessed.issueCount, 0);
    assert.ok(assessed.unknownCount >= 2);
  }
  const parsed = report({
    blockFetchStatus: [null, "bad", listener({ lastBlock: -1 })],
    takerFetchStats: [null, taker({ averageIntervalMs: "5000" })],
  });
  assert.equal(parsed.invalidListenerCount, 2);
  assert.equal(parsed.invalidTakerCount, 1);
  assert.equal(parsed.listeners[0].lastBlock, undefined);
  assert.equal(assessSystemHealth(parsed, now).takers[0].state, "unknown");
});

test("stale or absent service timestamps never show old listener/taker states as current", () => {
  for (const timestamp of [
    undefined,
    "invalid",
    new Date(now + 60_000).toISOString(),
    iso(HEALTH_REPORT_MAX_AGE_MS + 1),
  ]) {
    const assessed = assessSystemHealth(
      report({
        timestamp,
        blockFetchStatus: [listener()],
        takerFetchStats: [taker()],
      }),
      now,
    );
    assert.notEqual(assessed.freshness, "fresh");
    assert.equal(assessed.listeners[0].state, "unknown");
    assert.equal(assessed.takers[0].state, "unknown");
  }
});

test("heartbeat threshold adapts to reported cadence and conservatively reconciles two ages", () => {
  const assessed = assessSystemHealth(
    report({
      takerFetchStats: [
        taker({ secondsSinceLastFetch: 61 }),
        taker({
          serverId: "slow",
          averageIntervalMs: 120_000,
          lastFetchAt: iso(61_000),
          secondsSinceLastFetch: 61,
        }),
        taker({ serverId: "missing-cadence", averageIntervalMs: undefined }),
        taker({
          serverId: "future-clock",
          lastFetchAt: new Date(now + 60_000).toISOString(),
          secondsSinceLastFetch: 0,
        }),
      ],
    }),
    now,
  );
  assert.deepEqual(
    assessed.takers.map((row) => row.state),
    ["overdue", "active", "unknown", "unknown"],
  );
  assert.equal(assessed.takers[0].ageMs, 61_000);
  assert.equal(assessed.takers[1].overdueAfterMs, 360_000);
});

test("heartbeat ages advance between requests instead of freezing at the service's seconds counter", () => {
  const parsed = report({
    takerFetchStats: [
      taker({ lastFetchAt: undefined, secondsSinceLastFetch: 1 }),
    ],
  });
  const assessed = assessSystemHealth(parsed, now + 61_000);
  assert.equal(assessed.takers[0].ageMs, 62_000);
  assert.equal(assessed.takers[0].state, "overdue");
});

test("coverage summaries separate disabled listeners and reported taker cadence from API health", () => {
  const parsed = report({
    blockFetchStatus: [
      listener(),
      listener({ chainId: 137, eventsFetchingEnabled: false }),
    ],
    takerFetchStats: [taker()],
  });
  const assessed = assessSystemHealth(parsed, now);
  assert.deepEqual(summarizeHealthCoverage(parsed, assessed, "listener"), {
    label: "1 active · 1 disabled",
    needsReview: false,
  });
  assert.deepEqual(summarizeHealthCoverage(parsed, assessed, "taker"), {
    label: "1 within threshold",
    needsReview: false,
  });
});

test("missing, empty, malformed and stale worker coverage remain explicit", () => {
  for (const [fields, label, needsReview] of [
    [{ chains: [{ chainId: 1 }] }, "Unreported", false],
    [{ blockFetchStatus: [] }, "None reported", false],
    [{ blockFetchStatus: {} }, "Invalid report", true],
    [{ blockFetchStatus: [null] }, "1 malformed", true],
    [
      {
        blockFetchStatus: [listener()],
        timestamp: iso(HEALTH_REPORT_MAX_AGE_MS + 1),
      },
      "1 unknown",
      false,
    ],
  ] as const) {
    const parsed = report(fields);
    assert.deepEqual(
      summarizeHealthCoverage(
        parsed,
        assessSystemHealth(parsed, now),
        "listener",
      ),
      { label, needsReview },
    );
  }
});

test("coverage summaries flag inactive and overdue workers without turning unknown into success", () => {
  const parsed = report({
    blockFetchStatus: [
      listener({ listenerActive: false }),
      listener({ chainId: 137, updatedAt: iso(HEALTH_REPORT_MAX_AGE_MS + 1) }),
      listener({ chainId: 56, eventsFetchingEnabled: undefined }),
    ],
    takerFetchStats: [
      taker({ secondsSinceLastFetch: 61 }),
      taker({ averageIntervalMs: undefined }),
    ],
  });
  const assessed = assessSystemHealth(parsed, now);
  assert.deepEqual(summarizeHealthCoverage(parsed, assessed, "listener"), {
    label: "1 inactive · 1 overdue · 1 unknown",
    needsReview: true,
  });
  assert.deepEqual(summarizeHealthCoverage(parsed, assessed, "taker"), {
    label: "1 overdue · 1 unknown",
    needsReview: true,
  });
});

test("telemetry completeness is independent of API reachability and worker outcomes", () => {
  const complete = report({
    blockFetchStatus: [listener({ listenerActive: false })],
    takerFetchStats: [taker()],
  });
  const assessed = assessSystemHealth(complete, now);
  assert.equal(assessed.issueCount, 1);
  assert.equal(summarizeSystemCoverage(complete, assessed).state, "complete");
  const v1 = report({ chains: [{ chainId: 1 }], takerFetchStats: [taker()] });
  const coverage = summarizeSystemCoverage(v1, assessSystemHealth(v1, now));
  assert.equal(coverage.state, "partial");
  assert.ok(coverage.missing.includes("Listener signals unreported"));
  assert.equal(
    summarizeSystemCoverage(complete, assessed, true).state,
    "unknown",
  );
  assert.equal(summarizeSystemCoverage().state, "unknown");
  for (const timestamp of [
    undefined,
    "invalid",
    iso(HEALTH_REPORT_MAX_AGE_MS + 1),
    new Date(now + 60_000).toISOString(),
  ]) {
    const value = report({
      timestamp,
      blockFetchStatus: [listener()],
      takerFetchStats: [taker()],
    });
    assert.equal(
      summarizeSystemCoverage(value, assessSystemHealth(value, now)).state,
      "unknown",
    );
  }
});

test("empty, missing, malformed and partly missing worker reports never count as complete coverage", () => {
  for (const payload of [
    {},
    { blockFetchStatus: [], takerFetchStats: [] },
    { blockFetchStatus: {}, takerFetchStats: [null] },
  ]) {
    const value = report(payload);
    assert.equal(
      summarizeSystemCoverage(value, assessSystemHealth(value, now)).state,
      "unknown",
    );
  }
  const partial = report({
    chains: [{ chainId: 1 }, { chainId: 137 }],
    blockFetchStatus: [listener()],
    takerFetchStats: [taker()],
  });
  const result = summarizeSystemCoverage(
    partial,
    assessSystemHealth(partial, now),
  );
  assert.equal(result.state, "partial");
  assert.ok(result.missing.includes("1 listener signal unknown"));
});

test("service order exposure separates current failures, latest failed attempts and completed recovery", () => {
  const order = (
    hash: string,
    status: string,
    source: "v1" | "v2",
    latest = "success",
    errors = 0,
    deadline = now / 1000 - 1,
  ): ListOrder =>
    ({
      hash,
      source,
      timestamp: iso(60_000),
      order: { witness: { chainId: 1, deadline } },
      metadata: {
        status,
        chunkSummary: { error: errors, lastChunkStatus: latest },
      },
    }) as ListOrder;
  const input = [
    order("active-error", "pending", "v2", "error", 2),
    order("failed", "failed", "v2", "error", 1),
    order("recovered", "completed", "v2", "success", 1),
    order("other-service", "failed", "v1", "error", 1),
    order("future-deadline", "pending", "v2", "success", 0, now / 1000 + 60),
  ];
  const impact = buildServiceOrderImpact(input, "v2", now);
  assert.equal(impact.orders.length, 4);
  assert.equal(impact.active.length, 2);
  assert.deepEqual(
    impact.overdue.map((order) => order.hash),
    ["active-error"],
  );
  assert.deepEqual(
    impact.failed.map((order) => order.hash),
    ["failed"],
  );
  assert.deepEqual(
    impact.latestErrors.map((order) => order.hash),
    ["active-error", "failed"],
  );
  assert.deepEqual(
    impact.recovered.map((order) => order.hash),
    ["recovered"],
  );
  assert.equal(impact.oldestActivePlacedAt, now - 60_000);
  for (const [filters, expected] of [
    [{ status: "failed" }, impact.failed],
    [{ errors: "latest" }, impact.latestErrors],
    [{ errors: "recovered" }, impact.recovered],
  ] as const) {
    const link = new URL(
      serviceOrdersHref(
        "period=30&chain_id=1&partner_id=sushiswap&order_search=old&order_status=expired&order_source=v1",
        "v2",
        filters,
      ),
      "http://ops.test",
    );
    assert.equal(link.searchParams.get("period"), "30");
    assert.deepEqual(link.searchParams.getAll("chain_id"), ["1"]);
    assert.deepEqual(link.searchParams.getAll("partner_id"), ["sushiswap"]);
    assert.equal(link.searchParams.has("order_search"), false);
    const selection = readInvestigationFilters(
      Object.fromEntries(link.searchParams),
    );
    assert.deepEqual(
      investigateOrders(input, selection, undefined, now)
        .map((order) => order.hash)
        .sort(),
      expected.map((order) => order.hash).sort(),
    );
  }
  const network = new URL(
    serviceOrdersHref("period=7&chain_id=1&chain_id=137", "v1", {
      chainId: 56,
      deadline: "past",
      status: "active",
    }),
    "http://ops.test",
  );
  assert.deepEqual(network.searchParams.getAll("chain_id"), ["56"]);
  assert.equal(network.searchParams.get("order_source"), "v1");
  assert.equal(network.searchParams.get("order_deadline"), "past");
});

test("status requests use bounded timeout and the caller's cancellation signal", async (t) => {
  const controller = new AbortController();
  t.mock.method(
    axios,
    "get",
    async (_url: string, config: { timeout: number; signal: AbortSignal }) => {
      assert.equal(config.timeout, 10_000);
      assert.equal(config.signal, controller.signal);
      return { data: { version: "test" } };
    },
  );
  const response = await getServiceStatus(
    CURRENT_SINK_API_URL,
    controller.signal,
  );
  assert.equal(response.payload.version, "test");
  assert.ok(response.latencyMs >= 0);
  controller.abort();
  await assert.rejects(
    getServiceStatus(CURRENT_SINK_API_URL, controller.signal),
    { name: "AbortError" },
  );
});

test("HTTP, timeout and invalid payload failures are distinct from an empty valid object", async (t) => {
  const mock = t.mock.method(axios, "get", async () => ({ data: {} }));
  assert.deepEqual((await getServiceStatus(CURRENT_SINK_API_URL)).payload, {});
  mock.mock.mockImplementation(async () => ({ data: [] }));
  await assert.rejects(
    getServiceStatus(CURRENT_SINK_API_URL),
    (error: unknown) =>
      error instanceof ServiceStatusError && error.kind === "invalid",
  );
  mock.mock.mockImplementation(async () => {
    throw new AxiosError("timeout", "ECONNABORTED");
  });
  await assert.rejects(
    getServiceStatus(CURRENT_SINK_API_URL),
    (error: unknown) =>
      error instanceof ServiceStatusError && error.kind === "timeout",
  );
  mock.mock.mockImplementation(async () => {
    throw new AxiosError("offline", undefined, undefined, undefined, {
      status: 503,
    } as never);
  });
  await assert.rejects(getServiceStatus(CURRENT_SINK_API_URL), /HTTP 503/);
});

test("health and catalog share exactly one in-flight status request per service", async (t) => {
  const cache = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  t.after(() => cache.clear());
  const calls: string[] = [];
  t.mock.method(axios, "get", async (url: string) => {
    calls.push(url);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      data:
        url === SPOT_CONFIG_URL
          ? { "*": { dex: {} } }
          : { version: "test", chains: [] },
    };
  });
  const statuses = [CURRENT_SINK_API_URL, SINK_API_URLS.prod].map((endpoint) =>
    cache.fetchQuery(serviceStatusQueryOptions(endpoint)),
  );
  const config = getSpotConfig(
    undefined,
    async (endpoint) =>
      (await cache.fetchQuery(serviceStatusQueryOptions(endpoint))).payload,
  );
  await Promise.all([...statuses, config]);
  assert.equal(
    calls.length,
    3,
    "two parallel status calls plus one config request",
  );
  for (const endpoint of [CURRENT_SINK_API_URL, SINK_API_URLS.prod]) {
    assert.equal(calls.filter((url) => url === `${endpoint}/status`).length, 1);
    await cache.fetchQuery(serviceStatusQueryOptions(endpoint));
  }
  assert.equal(calls.length, 3, "fresh navigation reuses raw status results");
  cache.clear();
});

test("failed status refresh retains error and forces a real retry instead of restoring cached success", async (t) => {
  const cache = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  let failing = false;
  let requests = 0;
  t.mock.method(axios, "get", async () => {
    requests++;
    if (failing) throw new Error("offline");
    return { data: { version: "old" } };
  });
  const options = serviceStatusQueryOptions(CURRENT_SINK_API_URL);
  const old = await cache.fetchQuery(options);
  failing = true;
  await assert.rejects(cache.fetchQuery({ ...options, staleTime: 0 }));
  const state = cache.getQueryState(options.queryKey);
  assert.equal(state?.status, "error");
  assert.equal(state?.data, old);
  await assert.rejects(cache.fetchQuery(options));
  assert.equal(
    requests,
    3,
    "retry actually checks the endpoint despite a recently cached success",
  );
  cache.clear();
});

test("one service failure does not block the other independent status query", async (t) => {
  const cache = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  t.mock.method(axios, "get", async (url: string) => {
    if (url.startsWith(CURRENT_SINK_API_URL)) throw new Error("offline");
    return { data: { version: "original", takerFetchStats: [taker()] } };
  });
  const results = await Promise.allSettled(
    [CURRENT_SINK_API_URL, SINK_API_URLS.prod].map((endpoint) =>
      cache.fetchQuery(serviceStatusQueryOptions(endpoint)),
    ),
  );
  assert.deepEqual(
    results.map((result) => result.status),
    ["rejected", "fulfilled"],
  );
  cache.clear();
});
