"use client";

import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useState } from "react";
import { InlineSkeleton } from "./loading-skeletons";

export function StaffSignIn({
  clientId,
  domain,
}: {
  clientId: string;
  domain: string;
}) {
  // Google calls this option `hd`; the installed wrapper still types its legacy name.
  const workspaceHint = { hd: domain };
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadSuccess={() => setScriptReady(true)}
      onScriptLoadError={() =>
        setError(
          "Google sign-in could not load. Check your connection and reload.",
        )
      }
    >
      <div
        className="flex flex-col items-center gap-4"
        aria-busy={pending || (!scriptReady && !error)}
      >
        <div
          className={`relative flex min-h-10 min-w-60 items-center justify-center ${pending ? "pointer-events-none opacity-60" : ""}`}
        >
          {!scriptReady && !error && (
            <div className="absolute inset-0">
              <InlineSkeleton label="Loading sign-in" className="h-10 w-60" />
            </div>
          )}
          <GoogleLogin
            {...workspaceHint}
            onSuccess={async ({ credential }) => {
              setError("");
              setPending(true);
              try {
                const response = await fetch("/api/auth/session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ credential }),
                });
                const data = await response.json();
                if (!response.ok)
                  throw new Error(data.error || "Sign-in failed");
                window.location.assign("/");
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Sign-in failed. Try again.",
                );
                setPending(false);
              }
            }}
            onError={() => setError("Google sign-in failed. Try again.")}
            auto_select={false}
          />
        </div>
        {pending && (
          <InlineSkeleton label="Verifying your account" className="h-4 w-44" />
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </GoogleOAuthProvider>
  );
}
