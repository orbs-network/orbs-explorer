import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getStaffDomain } from "./auth-config";

export const SESSION_COOKIE = "orbs_ops_session";
export const SESSION_SECONDS = 8 * 60 * 60;
const SESSION_ISSUER = "orbs-ops";

export type StaffUser = { id: string; email: string; name: string };

export function staffIdentity(payload: JWTPayload): StaffUser | null {
  const domain = getStaffDomain();
  if (
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true ||
    payload.hd !== domain ||
    !payload.email.toLowerCase().endsWith(`@${domain}`)
  )
    return null;
  return {
    id: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : payload.email,
  };
}

function sessionKey(): Uint8Array {
  const secret = process.env.OPS_SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("OPS_SESSION_SECRET must contain at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(user: StaffUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(sessionKey());
}

export async function readSessionToken(
  token?: string,
): Promise<StaffUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_ISSUER,
      requiredClaims: ["sub", "email", "iat", "exp"],
      maxTokenAge: SESSION_SECONDS,
    });
    const domain = getStaffDomain();
    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      !payload.email.toLowerCase().endsWith(`@${domain}`)
    )
      return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : payload.email,
    };
  } catch {
    return null;
  }
}
