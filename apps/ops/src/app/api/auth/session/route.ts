import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/auth";
import { createSession, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/session";

import { isAuthConfigured } from "@/lib/auth-config";
import {
  verifyGoogleCredential,
  StaffAccessDeniedError,
} from "@/lib/google-auth";
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403, headers: privateHeaders },
    );
  }
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Staff sign-in is not configured" },
      { status: 503, headers: privateHeaders },
    );
  }
  let credential: unknown;
  try {
    ({ credential } = await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid sign-in request" },
      { status: 400, headers: privateHeaders },
    );
  }
  if (typeof credential !== "string" || credential.length > 16_384) {
    return NextResponse.json(
      { error: "Google credential required" },
      { status: 400, headers: privateHeaders },
    );
  }
  try {
    const user = await verifyGoogleCredential(credential);
    const response = NextResponse.json(
      { ok: true },
      { headers: privateHeaders },
    );
    response.cookies.set(SESSION_COOKIE, await createSession(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof StaffAccessDeniedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403, headers: privateHeaders },
      );
    }
    return NextResponse.json(
      { error: "Google sign-in could not be verified. Try again." },
      { status: 401, headers: privateHeaders },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403, headers: privateHeaders },
    );
  }
  const response = NextResponse.json({ ok: true }, { headers: privateHeaders });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
