import { Page } from "@/components/page";
import { PerpetualHubDashboard } from "@/components/perpetual-hub/dashboard";

export default function PerpetualHubEventsPage() {
  return (
    <Page>
      <PerpetualHubDashboard initialTab="events" />
    </Page>
  );
}
