import { OperationsView } from "@/components/operations/operations-view";
import { SecurityView } from "@/components/security/security-view";
import { requireStaffUser } from "@/lib/auth";
import { AUTH_DISABLED_USER_ID } from "@/lib/auth-bypass";
import { LOCAL_USER_ID } from "@/lib/local-auth";
import { redirect } from "next/navigation";
import { getLegacyAdapterRedirect } from "@/lib/adapter-navigation";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const href = getLegacyAdapterRedirect(params, "security_view");
  if (href) redirect(href);
  const reviewsOrders =
    (typeof params.security_view === "string" &&
      ["findings", "activity", "coverage", "orders"].includes(
        params.security_view,
      )) ||
    params.health_view === "orders";
  const user = await requireStaffUser();
  return (
    <OperationsView
      title="Service & security"
      description="Check services, workers, and unusual activity."
      dataContext={reviewsOrders ? "orders" : "services"}
      showContentDuringHistoryLoad
    >
      <SecurityView
        dashboardAccess={
          user.id === AUTH_DISABLED_USER_ID
            ? "disabled"
            : user.id === LOCAL_USER_ID
              ? "local"
              : "google"
        }
      />
    </OperationsView>
  );
}
