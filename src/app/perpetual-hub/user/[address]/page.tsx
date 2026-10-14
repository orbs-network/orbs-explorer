import { PerpetualHubUserView } from "@/components/perpetual-hub/user-view";
import { use } from "react";

function PerpetualHubUserPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  return (
    <main id="main-content" className="min-w-0">
      <PerpetualHubUserView address={address} />
    </main>
  );
}

export default PerpetualHubUserPage;
