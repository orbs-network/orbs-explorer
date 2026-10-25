import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "./lib/session";
import { getAuthBypassUser } from "./lib/auth-bypass";
import {
  TELEGRAM_ALERTS_ENABLED,
  telegramAlertsDisabledResponse,
} from "./lib/telegram-alerts";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    !TELEGRAM_ALERTS_ENABLED &&
    (pathname === "/api/cron/telegram-error-alerts" ||
      pathname === "/api/run-telegram-alerts")
  )
    return telegramAlertsDisabledResponse();
  const bypassUser = getAuthBypassUser(request.headers.get("host"));
  if (bypassUser && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (
    pathname === "/login" ||
    pathname === "/api/auth/session" ||
    (TELEGRAM_ALERTS_ENABLED && pathname === "/api/cron/telegram-error-alerts")
  )
    return NextResponse.next();

  const user =
    bypassUser ||
    (await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value));
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Staff sign-in required" },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|icon.svg).*)"],
};
