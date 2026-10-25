import { getLocalDevelopmentUser } from "./local-auth";
import type { StaffUser } from "./session";

export const AUTH_DISABLED_USER_ID = "auth-disabled";

export function getAuthBypassUser(host: string | null): StaffUser | null {
  // Temporary: set OPS_REQUIRE_GOOGLE_AUTH=true to restore the Google gate.
  if (process.env.OPS_REQUIRE_GOOGLE_AUTH !== "true") {
    return {
      id: AUTH_DISABLED_USER_ID,
      email: "",
      name: "Sign-in disabled",
    };
  }
  return getLocalDevelopmentUser(host);
}
