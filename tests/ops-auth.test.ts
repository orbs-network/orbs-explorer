import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import {
  createSession,
  readSessionToken,
  staffIdentity,
} from "../apps/ops/src/lib/session";

const user = { id: "staff-123", email: "staff@orbs.com", name: "Staff" };

test("staff identity requires a verified Google Workspace domain", () => {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    hd: "orbs.com",
    email_verified: true,
  };
  assert.deepEqual(staffIdentity(payload), user);
  assert.equal(staffIdentity({ ...payload, hd: undefined }), null);
  assert.equal(staffIdentity({ ...payload, hd: "other.com" }), null);
  assert.equal(staffIdentity({ ...payload, email_verified: false }), null);
  assert.equal(
    staffIdentity({ ...payload, email: "staff@orbs.com.attacker.example" }),
    null,
  );
});

test("ops sessions reject tampering, expiry, wrong audience, and missing configuration", async (t) => {
  const previous = process.env.OPS_SESSION_SECRET;
  process.env.OPS_SESSION_SECRET = "test-secret-with-at-least-thirty-two-bytes";
  t.after(() => {
    if (previous === undefined) delete process.env.OPS_SESSION_SECRET;
    else process.env.OPS_SESSION_SECRET = previous;
  });
  const token = await createSession(user);
  assert.deepEqual(await readSessionToken(token), user);
  assert.equal(await readSessionToken(token + "tampered"), null);
  const key = new TextEncoder().encode(process.env.OPS_SESSION_SECRET);
  const expired = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("orbs-ops")
    .setAudience("orbs-ops")
    .setExpirationTime(0)
    .sign(key);
  assert.equal(await readSessionToken(expired), null);
  const wrongAudience = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("orbs-ops")
    .setAudience("public-explorer")
    .setExpirationTime("1h")
    .sign(key);
  assert.equal(await readSessionToken(wrongAudience), null);
  process.env.OPS_SESSION_SECRET =
    "a-different-secret-with-at-least-thirty-two-bytes";
  assert.equal(await readSessionToken(token), null);
  delete process.env.OPS_SESSION_SECRET;
  assert.equal(await readSessionToken(token), null);
  await assert.rejects(() => createSession(user));
});
