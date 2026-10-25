export function getGoogleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
}

export function getStaffDomain(): string {
  return (process.env.OPS_GOOGLE_DOMAIN?.trim() || "orbs.com").toLowerCase();
}

export function isAuthConfigured(): boolean {
  const secret = process.env.OPS_SESSION_SECRET;
  return Boolean(
    getGoogleClientId().endsWith(".apps.googleusercontent.com") &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(getStaffDomain()) &&
    secret &&
    Buffer.byteLength(secret) >= 32,
  );
}
