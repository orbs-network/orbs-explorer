"use client";

import { ActivityTime } from "@/components/activity-summary";
import { getOrderTypeExplanation } from "@orbs/domain/activity/order-story";

import { TokenAmount } from "@/components/token-amount";
import { TransactionDisplay } from "@/components/transaction-display";
import { formatDuration, shortenAddress } from "@orbs/domain/utils/utils";

import { Copy } from "@orbs/ui/controls/copy";
import { OrderExecutionHistory } from "./order-chunks";
import BN from "bignumber.js";
import { Network } from "@orbs/ui/controls/network";
import { Partner } from "@orbs/ui/controls/partner";
import { useNetwork } from "@orbs/domain/hooks/use-network";
import { OrderStatus } from "./order-status";
import { OrderAdditionalDetails, OrderContractDetails } from "./order-details";
import { OrderPriceRate } from "./order-price-rate";

import { useSpotOrder } from "@orbs/domain/twap";
import { OrderViewContext } from "./context";
import { useOrderViewContext } from "./use-order-view-context";
import { SpotOrderUiLogs } from "./ui-logs";
import { OriginalOrder } from "./original-order";
import { parseOrderType } from "@orbs/domain/twap";
import { useSearchParams } from "next/navigation";

const OrderHeader = () => {
  const { type, order, chainId, hash, partner, partnerName } =
    useOrderViewContext();
  const network = useNetwork(chainId);
  const showPartner =
    partnerName && partnerName.toLowerCase() !== network?.name.toLowerCase();
  const isDev = useSearchParams().get("dev") === "true";
  return (
    <TransactionDisplay.Hero className="p-4 mb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {parseOrderType(type)} order
          </h1>
          {hash && (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Order ID</span>
              <Copy
                text={shortenAddress(hash, 8)}
                value={hash}
                tooltip={hash}
              />
            </div>
          )}
        </div>
        {isDev && (
          <div className="flex gap-2">
            <OriginalOrder />
            <SpotOrderUiLogs />
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <TransactionDisplay.SwapDirection
          fromAddress={order.order.witness.input.token}
          toAddress={order.order.witness.output.token}
          chainId={chainId}
        />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Network</span>
          <Network
            chainId={chainId || 0}
            showChainId={false}
            variant="compact"
          />
        </div>
        {showPartner && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Trading app</span>
            <Partner
              data={partner || { name: partnerName }}
              variant="compact"
            />
          </div>
        )}
      </div>
    </TransactionDisplay.Hero>
  );
};

const OrderSettings = () => {
  const {
    order,
    type,
    chainId,
    totalInAmount,
    totalMinOutAmount,
    srcToken,
    dstToken,
    triggerPriceRate,
    limitPriceRate,
    totalChunks,
    epoch,
  } = useOrderViewContext();
  const rate = BN(triggerPriceRate || 0).gt(0)
    ? triggerPriceRate
    : limitPriceRate;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-base font-semibold">Order settings</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {getOrderTypeExplanation(type)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-2">
        <OrderFact label="Order amount">
          <TokenAmount
            amountRaw={totalInAmount.raw}
            address={order.order.witness.input.token}
            chainId={chainId}
          />
        </OrderFact>
        {[
          order.order.witness.output.limit,
          order.order.witness.output.triggerLower,
          order.order.witness.output.triggerUpper,
          order.order.witness.output.stop,
        ].some((value) => BN(value || 0).gt(1)) && (
          <OrderFact
            label={
              BN(triggerPriceRate || 0).gt(0)
                ? "Price that starts a trade"
                : "Minimum trade price"
            }
          >
            {BN(rate || 0).gt(0) ? (
              <OrderPriceRate
                rate={rate}
                srcToken={srcToken}
                dstToken={dstToken}
                chainId={chainId}
              />
            ) : (
              "Price units unavailable"
            )}
          </OrderFact>
        )}
        {BN(totalMinOutAmount.raw || 0).gt(0) && (
          <OrderFact label="Minimum received for the full order">
            <TokenAmount
              amountRaw={totalMinOutAmount.raw}
              address={order.order.witness.output.token}
              chainId={chainId}
            />
          </OrderFact>
        )}
        <OrderFact label="Expires">
          <ActivityTime value={Number(order.order.witness.deadline) * 1000} />
        </OrderFact>
        <OrderFact label="Price protection (slippage)">
          {Number.isFinite(order.order.witness.slippage)
            ? `${order.order.witness.slippage / 100}%`
            : "Not reported"}
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
            Maximum accepted drop from the quoted amount.
          </p>
        </OrderFact>
        {totalChunks > 1 && (
          <OrderFact label="Time between trades">
            {Number(epoch) > 0
              ? formatDuration(epoch)
              : "No fixed delay reported"}
          </OrderFact>
        )}
      </dl>
    </section>
  );
};
function OrderFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium tabular-nums">
        {children}
      </dd>
    </div>
  );
}

export function OrderView({
  hash,
  backHref,
  defaultBackHref,
}: {
  hash: string;
  backHref?: string;
  defaultBackHref?: string;
}) {
  const orderPayload = useSpotOrder(hash);

  if (orderPayload.isLoading) {
    return (
      <TransactionDisplay.Container>
        <TransactionDisplay.Loading message="Loading order…" />
      </TransactionDisplay.Container>
    );
  }

  if (orderPayload.isError) {
    return (
      <TransactionDisplay.Container>
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          Couldn’t load this order.{" "}
          <button
            type="button"
            onClick={() => orderPayload.refetch()}
            className="underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      </TransactionDisplay.Container>
    );
  }

  if (!orderPayload.originalOrder) {
    return (
      <TransactionDisplay.Container>
        <TransactionDisplay.NotFound
          title="Order Not Found"
          description="The selected order services did not return this order hash. Check the hash or find the order using your wallet; a fill transaction has a different hash from its parent order."
        />
      </TransactionDisplay.Container>
    );
  }

  return (
    <OrderViewContext.Provider
      value={{ ...orderPayload, order: orderPayload.originalOrder! }}
    >
      <TransactionDisplay.Container className="gap-3 sm:py-4">
        <TransactionDisplay.ContainerHeader
          backHref={backHref}
          defaultBackHref={defaultBackHref}
        />
        <OrderHeader />
        <OrderStatus />
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <OrderSettings />
          <OrderExecutionHistory />
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          To change or cancel this order, return to the trading app where you
          placed it.
        </p>
        <div className="space-y-3">
          <OrderAdditionalDetails />
          <OrderContractDetails />
        </div>
      </TransactionDisplay.Container>
    </OrderViewContext.Provider>
  );
}
