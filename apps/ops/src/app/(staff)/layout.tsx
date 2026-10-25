import type { ReactNode } from "react";
import { requireStaffUser } from "@/lib/auth";
import { StaffNav } from "@/components/staff-nav";
import { LOCAL_USER_ID } from "@/lib/local-auth";
import { AUTH_DISABLED_USER_ID } from "@/lib/auth-bypass";
import { PageHistoryProvider } from "@/components/page-history-provider";

export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireStaffUser();
  return (
    <PageHistoryProvider>
      <StaffNav
        email={user.email}
        accessMode={
          user.id === AUTH_DISABLED_USER_ID
            ? "disabled"
            : user.id === LOCAL_USER_ID
              ? "local"
              : "google"
        }
      >
        {children}
      </StaffNav>
    </PageHistoryProvider>
  );
}
