import { PerpetualHubStateView } from "@/components/perpetual-hub/state-view";
import { use } from "react";

function PerpetualHubStatePage({
  params,
}: {
  params: Promise<{ seq: string }>;
}) {
  const { seq } = use(params);
  return <PerpetualHubStateView seq={seq} />;
}

export default PerpetualHubStatePage;
