import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../apps/ops/src/proxy";
import { getLocalDevelopmentUser } from "../apps/ops/src/lib/local-auth";
import {
  AUTH_DISABLED_USER_ID,
  getAuthBypassUser,
} from "../apps/ops/src/lib/auth-bypass";

test("local auth bypass works only with the flag in development on loopback hosts", async (t) => {
  const names = [
    "NODE_ENV",
    "VERCEL",
    "OPS_LOCAL_AUTH_BYPASS",
    "OPS_REQUIRE_GOOGLE_AUTH",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  process.env.NODE_ENV = "development";
  process.env.OPS_REQUIRE_GOOGLE_AUTH = "true";
  process.env.OPS_LOCAL_AUTH_BYPASS = "true";
  delete process.env.VERCEL;
  for (const host of ["localhost:3004", "127.0.0.1:3004", "[::1]:3004"])
    assert.equal(getLocalDevelopmentUser(host)?.name, "Local development");
  for (const host of [
    null,
    "ops.example.com",
    "localhost.attacker.example",
    "192.168.1.2:3004",
    "invalid host",
  ])
    assert.equal(getLocalDevelopmentUser(host), null);
  const localLogin = await proxy(
    new NextRequest("http://localhost:3004/login", {
      headers: { host: "localhost:3004" },
    }),
  );
  assert.equal(localLogin.status, 307);
  assert.equal(localLogin.headers.get("location"), "http://localhost:3004/");
  process.env.NODE_ENV = "production";
  assert.equal(getLocalDevelopmentUser("localhost:3004"), null);
  const productionPage = await proxy(
    new NextRequest("http://localhost:3004/", {
      headers: { host: "localhost:3004" },
    }),
  );
  assert.equal(productionPage.status, 307);
  assert.equal(
    productionPage.headers.get("location"),
    "http://localhost:3004/login",
  );
  process.env.NODE_ENV = "development";
  process.env.VERCEL = "1";
  assert.equal(getLocalDevelopmentUser("localhost:3004"), null);
  delete process.env.VERCEL;
  process.env.OPS_LOCAL_AUTH_BYPASS = "false";
  assert.equal(getLocalDevelopmentUser("localhost:3004"), null);
});

test("temporary auth disable allows deployed pages and APIs and can restore the gate", async (t) => {
  const names = ["NODE_ENV", "VERCEL", "OPS_REQUIRE_GOOGLE_AUTH"] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  process.env.NODE_ENV = "production";
  process.env.VERCEL = "1";

  for (const setting of [undefined, "false", "true"]) {
    if (setting === undefined) delete process.env.OPS_REQUIRE_GOOGLE_AUTH;
    else process.env.OPS_REQUIRE_GOOGLE_AUTH = setting;
    const authRequired = setting === "true";
    assert.equal(
      getAuthBypassUser("ops.example.com")?.id,
      authRequired ? undefined : AUTH_DISABLED_USER_ID,
    );
    for (const path of ["/orders", "/api/tokens"]) {
      const response = await proxy(
        new NextRequest(`https://ops.example.com${path}`, {
          headers: { host: "ops.example.com" },
        }),
      );
      assert.equal(
        response.status,
        authRequired ? (path.startsWith("/api/") ? 401 : 307) : 200,
      );
      if (!authRequired)
        assert.equal(
          response.headers.get("Cache-Control"),
          "private, no-store",
        );
    }
    const login = await proxy(
      new NextRequest("https://ops.example.com/login", {
        headers: { host: "ops.example.com" },
      }),
    );
    assert.equal(login.status, authRequired ? 200 : 307);
    if (!authRequired)
      assert.equal(login.headers.get("location"), "https://ops.example.com/");
  }
});
