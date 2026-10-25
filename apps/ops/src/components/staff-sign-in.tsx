"use client";

import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useState } from "react";

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
  return (
    <GoogleOAuthProvider
      clientId={clientId}
      onScriptLoadError={() =>
        setError(
          "Google sign-in could not load. Check your connection and reload.",
        )
      }
    >
      <div className="flex flex-col items-center gap-4" aria-busy={pending}>
        <div className={pending ? "pointer-events-none opacity-60" : ""}>
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
          <p role="status" className="text-sm text-muted-foreground">
            Verifying your account…
          </p>
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
