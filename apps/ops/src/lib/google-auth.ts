import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { getGoogleClientId } from "./auth-config";
import { staffIdentity, type StaffUser } from "./session";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export class StaffAccessDeniedError extends Error {
  constructor() {
    super("Use your staff Google Workspace account");
  }
}

export async function verifyGoogleCredential(
  credential: string,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<StaffUser> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("Google sign-in is not configured");
  const { payload } = await jwtVerify(credential, keys, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    requiredClaims: ["sub", "email", "email_verified", "hd", "iat", "exp"],
    maxTokenAge: "10m",
  });
  const user = staffIdentity(payload);
  if (!user) throw new StaffAccessDeniedError();
  return user;
}
