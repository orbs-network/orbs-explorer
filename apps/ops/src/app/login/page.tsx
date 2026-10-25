import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth";
import {
  getGoogleClientId,
  getStaffDomain,
  isAuthConfigured,
} from "@/lib/auth-config";
import { StaffSignIn } from "@/components/staff-sign-in";

export default async function LoginPage() {
  if (await getStaffUser()) redirect("/");
  return (
    <main
      id="main-content"
      className="grid min-h-dvh place-items-center px-5 py-12"
    >
      <div className="w-full max-w-sm space-y-7 rounded-xl bg-card p-7 text-center shadow-panel">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            Orbs · Internal
          </p>
          <h1 className="text-2xl font-semibold">Operations</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sign in with your @{getStaffDomain()} Google account to view order
            activity and operational tools.
          </p>
        </div>
        {isAuthConfigured() ? (
          <StaffSignIn
            clientId={getGoogleClientId()}
            domain={getStaffDomain()}
          />
        ) : (
          <p
            role="status"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            Staff sign-in is not configured. Contact the dashboard
            administrator.
          </p>
        )}
      </div>
    </main>
  );
}
