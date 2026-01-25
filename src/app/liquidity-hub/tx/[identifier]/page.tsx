import { LiquidityHubTxView } from '@/components/liquidity-hub/tx-view'
import React, { use } from 'react'

function LiquidityHubTxPage({ params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = use(params);
  return <LiquidityHubTxView isPreview={false} identifier={identifier} />;
}

export default LiquidityHubTxPage;