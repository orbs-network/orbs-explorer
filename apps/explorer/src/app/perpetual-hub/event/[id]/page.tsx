import { PerpetualHubEventView } from "@/components/perpetual-hub/event-view";
import { use } from "react";

function PerpetualHubEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <main id="main-content" className="min-w-0">
      <PerpetualHubEventView id={id} />
    </main>
  );
}

export default PerpetualHubEventPage;
