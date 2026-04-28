import { PerpetualHubRollupView } from "@/components/perpetual-hub/rollup-view";
import { use } from "react";

function PerpetualHubRollupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PerpetualHubRollupView id={id} />;
}

export default PerpetualHubRollupPage;
