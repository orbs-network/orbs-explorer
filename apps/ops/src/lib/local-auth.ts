import type { StaffUser } from "./session";

export const LOCAL_USER_ID = "local-development";

export function getLocalDevelopmentUser(host: string | null): StaffUser | null {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.VERCEL === "1" ||
    process.env.OPS_LOCAL_AUTH_BYPASS !== "true" ||
    !host
  )
    return null;

  try {
    const { hostname } = new URL(`http://${host}`);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return null;
  } catch {
    return null;
  }
  return {
    id: LOCAL_USER_ID,
    email: "local@localhost",
    name: "Local development",
  };
}
