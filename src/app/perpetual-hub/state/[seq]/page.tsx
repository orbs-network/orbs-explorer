import { PerpetualHubStateView } from "@/components/perpetual-hub/state-view";
import { use } from "react";

function PerpetualHubStatePage({
  params,
}: {
  params: Promise<{ seq: string }>;
}) {
  const { seq } = use(params);
  return (
    <main id="main-content" className="min-w-0">
      <PerpetualHubStateView seq={seq} />
    </main>
  );
}

export default PerpetualHubStatePage;
