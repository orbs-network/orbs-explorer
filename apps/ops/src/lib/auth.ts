import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "./session";
import { getAuthBypassUser } from "./auth-bypass";

export async function getStaffUser() {
  const bypassUser = getAuthBypassUser((await headers()).get("host"));
  if (bypassUser) return bypassUser;
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireStaffUser() {
  const user = await getStaffUser();
  if (!user) redirect("/login");
  return user;
}

export async function authorizeApi(): Promise<NextResponse | null> {
  return (await getStaffUser())
    ? null
    : NextResponse.json(
        { error: "Staff sign-in required" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
}

export function isSameOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(request.url).origin;
}
