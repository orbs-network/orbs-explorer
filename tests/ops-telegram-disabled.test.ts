import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "../apps/ops/src/app/(staff)/api/cron/telegram-error-alerts/route";
import { POST } from "../apps/ops/src/app/(staff)/api/run-telegram-alerts/route";
import { proxy } from "../apps/ops/src/proxy";

test("disabled alert handlers return before authorization or any network work", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    throw new Error("Disabled alerts must not make network requests");
  });
  const cron = new Request("http://localhost:3004/api/cron/telegram-error-alerts");
  const manual = new Request("http://localhost:3004/api/run-telegram-alerts", {
    method: "POST",
    headers: { Origin: "https://invalid.example" },
  });
  // Deliberately omit cron credentials and use an invalid manual origin. Even
  // if the feature flag regresses, these requests cannot invoke the sender.
  for (const response of [await GET(cron), await POST(manual)]) {
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), {
      error: "Telegram alerts are temporarily disabled",
    });
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  }
  assert.equal(requests, 0);
});

test("disabled alert routes have no authentication bypass in the proxy", async () => {
  for (const path of ["/api/cron/telegram-error-alerts", "/api/run-telegram-alerts"]) {
    const response = await proxy(new NextRequest(`http://localhost:3004${path}`));
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  }
});
