import { LiquidityHubTxView } from "@/components/liquidity-hub/tx-view";
import { ROUTES } from "@/lib/routes";
import { use } from "react";

function LiquidityHubTxPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = use(params);
  return (
    <LiquidityHubTxView
      isPreview={false}
      identifier={identifier}
      defaultBackHref={ROUTES.LIQUIDITY_HUB.ROOT}
    />
  );
}

export default LiquidityHubTxPage;