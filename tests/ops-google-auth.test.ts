import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from "jose";
import {
  verifyGoogleCredential,
  StaffAccessDeniedError,
} from "../apps/ops/src/lib/google-auth";
import {
  getStaffDomain,
  isAuthConfigured,
} from "../apps/ops/src/lib/auth-config";

const clientId = "ops-test.apps.googleusercontent.com";
const identity = {
  sub: "staff-123",
  email: "staff@orbs.com",
  name: "Staff",
  email_verified: true,
  hd: "orbs.com",
};

function configure(t: TestContext) {
  const names = [
    "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
    "OPS_SESSION_SECRET",
    "OPS_GOOGLE_DOMAIN",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = clientId;
  process.env.OPS_SESSION_SECRET = "test-secret-with-at-least-thirty-two-bytes";
  process.env.OPS_GOOGLE_DOMAIN = "orbs.com";
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
}

async function issuer() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({
    keys: [{ ...jwk, alg: "RS256", use: "sig", kid: "google-test" }],
  });
  const sign = (overrides: JWTPayload = {}) =>
    new SignJWT({
      ...identity,
      iss: "https://accounts.google.com",
      aud: clientId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", kid: "google-test" })
      .sign(privateKey);
  return { keys, sign };
}

test("Google gate verifies a signed staff credential and issues an identity", async (t) => {
  configure(t);
  const google = await issuer();
  assert.deepEqual(
    await verifyGoogleCredential(await google.sign(), google.keys),
    { id: identity.sub, email: identity.email, name: identity.name },
  );
});

test("Google gate rejects bad signatures, other clients, invalid issuers, stale or incomplete tokens", async (t) => {
  configure(t);
  const google = await issuer();
  const attacker = await issuer();
  await assert.rejects(() => verifyGoogleCredential("not-a-jwt", google.keys));
  // Check each provider claim with a correctly signed credential.
  for (const claims of [
    { aud: "another-client.apps.googleusercontent.com" },
    { iss: "https://attacker.example" },
    { exp: 1 },
    { exp: undefined },
    { iat: undefined },
    { sub: undefined },
    { iat: Math.floor(Date.now() / 1000) - 601 },
  ]) {
    const token = await google.sign(claims);
    await assert.rejects(() => verifyGoogleCredential(token, google.keys));
  }
  const forged = await attacker.sign();
  await assert.rejects(() => verifyGoogleCredential(forged, google.keys));
});

test("Google gate rejects personal, other-domain and unverified accounts", async (t) => {
  configure(t);
  const google = await issuer();
  for (const claims of [
    { email: "person@gmail.com", hd: "gmail.com" },
    { email: "staff@other.com", hd: "other.com" },
    { email_verified: false },
    { email: "staff@orbs.com.attacker.example" },
  ]) {
    const token = await google.sign(claims);
    await assert.rejects(
      () => verifyGoogleCredential(token, google.keys),
      StaffAccessDeniedError,
    );
  }
});

test("Google gate fails closed without its required configuration", (t) => {
  configure(t);
  assert.equal(isAuthConfigured(), true);
  process.env.OPS_GOOGLE_DOMAIN = " ORBS.COM ";
  assert.equal(getStaffDomain(), "orbs.com");
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "";
  assert.equal(isAuthConfigured(), false);
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = clientId;
  process.env.OPS_SESSION_SECRET = "short";
  assert.equal(isAuthConfigured(), false);
  process.env.OPS_SESSION_SECRET = "test-secret-with-at-least-thirty-two-bytes";
  process.env.OPS_GOOGLE_DOMAIN = "not a domain";
  assert.equal(isAuthConfigured(), false);
});
