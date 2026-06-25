import { PerpetualHubEventView } from "@/components/perpetual-hub/event-view";
import { use } from "react";

function PerpetualHubEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PerpetualHubEventView id={id} />;
}

export default PerpetualHubEventPage;
