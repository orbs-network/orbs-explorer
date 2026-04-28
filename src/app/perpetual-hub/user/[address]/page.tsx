import { PerpetualHubUserView } from "@/components/perpetual-hub/user-view";
import { use } from "react";

function PerpetualHubUserPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  return <PerpetualHubUserView address={address} />;
}

export default PerpetualHubUserPage;
