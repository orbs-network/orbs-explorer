import { PerpetualHubRollupView } from "@/components/perpetual-hub/rollup-view";
import { use } from "react";

function PerpetualHubRollupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <main id="main-content" className="min-w-0">
      <PerpetualHubRollupView id={id} />
    </main>
  );
}

export default PerpetualHubRollupPage;
