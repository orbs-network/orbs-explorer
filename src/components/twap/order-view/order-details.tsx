import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import BN from "bignumber.js";
import { ActivityTime } from "@/components/activity-summary";
import { ExplorerLink } from "@/components/explorer-link";
import { TokenAmount } from "@/components/token-amount";
import { Amount } from "@/components/ui/amount";
import { useNetwork } from "@/lib/hooks/use-network";
import { OrderPriceRate } from "./order-price-rate";
import { useOrderViewContext } from "./use-order-view-context";

function DetailsDisclosure({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group min-w-0 rounded-lg border border-border bg-card">
      <summary
        aria-label={title}
        className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-4 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground group-open:rotate-90"
        />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
            {description}
          </p>
        </div>
      </summary>
      <div className="mx-4 min-w-0 border-t border-border/60 py-4">
        {children}
      </div>
    </details>
  );
}

function DetailFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 min-w-0 text-sm font-medium tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function AddressValue({
  address,
  chainId,
}: {
  address?: string;
  chainId?: number;
}) {
  return (
    <ExplorerLink value={address} chainId={chainId}>
      <span className="min-w-0 break-all font-mono text-xs">{address}</span>
    </ExplorerLink>
  );
}

export function OrderAdditionalDetails() {
  const {
    order,
    chainId,
    partnerName,
    swapper,
    feeUsd,
    srcToken,
    dstToken,
    executionRate,
    totalChunks,
    chunkAmount,
  } = useOrderViewContext();
  const network = useNetwork(chainId);
  const witness = order.order.witness;
  const hasTrades = (order.metadata.chunks ?? []).some(
    (chunk) => chunk.status === "success",
  );
  const hasFees =
    BN(feeUsd || 0).gt(0) ||
    (order.metadata.chunks ?? []).some(
      (chunk) =>
        chunk.status === "success" &&
        Boolean(chunk.displayOnlyFee?.trim()) &&
        BN(chunk.displayOnlyFee?.replace("$", "") ?? "").isFinite(),
    );
  return (
    <DetailsDisclosure
      title="More order details"
      description="Timing, wallets and trade results"
    >
      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <DetailFact label="Placed at">
          <ActivityTime value={order.timestamp} />
        </DetailFact>
        <DetailFact label="Expires">
          <ActivityTime value={Number(witness.deadline)} />
        </DetailFact>
        <DetailFact label="Scheduled start">
          {witness.start ? (
            <ActivityTime
              value={
                /^\d+$/.test(witness.start)
                  ? Number(witness.start)
                  : witness.start
              }
            />
          ) : (
            "Not reported"
          )}
        </DetailFact>
        <DetailFact label="Last automatic price check">
          <ActivityTime value={order.metadata.lastPriceCheck} />
        </DetailFact>
        <DetailFact label="Network">
          {network?.name ?? "Not identified"}
          {chainId && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              #{chainId}
            </span>
          )}
        </DetailFact>
        <DetailFact label="Trading app">
          {partnerName === "Unknown partner" ? "Not identified" : partnerName}
        </DetailFact>
      </dl>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-border/60 pt-5 sm:grid-cols-2">
        <DetailFact label="Your wallet">
          <AddressValue address={swapper} chainId={chainId} />
        </DetailFact>
        <DetailFact label="Wallet receiving the tokens">
          <AddressValue address={witness.output.recipient} chainId={chainId} />
        </DetailFact>
      </dl>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <DetailFact label="Average trade price">
          {BN(executionRate || 0).gt(0) ? (
            <OrderPriceRate
              rate={executionRate}
              srcToken={srcToken}
              dstToken={dstToken}
              chainId={chainId}
            />
          ) : (
            <span className="font-normal text-muted-foreground">
              {hasTrades ? "Price unavailable" : "No trades recorded yet"}
            </span>
          )}
        </DetailFact>
        <DetailFact label="Reported trade fees">
          {hasFees ? (
            <Amount amount={String(feeUsd)} prefix="$" />
          ) : (
            <span className="font-normal text-muted-foreground">
              Not reported
            </span>
          )}
        </DetailFact>
        {totalChunks > 1 && (
          <DetailFact label="Amount per scheduled trade">
            <TokenAmount
              amountRaw={chunkAmount.raw}
              address={witness.input.token}
              chainId={chainId}
            />
          </DetailFact>
        )}
      </dl>
    </DetailsDisclosure>
  );
}

export function OrderContractDetails() {
  const { order, chainId } = useOrderViewContext();
  const witness = order.order.witness;
  const addresses = [
    { label: "Reactor", address: witness.reactor },
    { label: "Executor", address: witness.executor },
    { label: "Exchange adapter", address: witness.exchange.adapter },
    { label: "Exchange referrer", address: witness.exchange.ref },
  ];
  return (
    <DetailsDisclosure
      title="Technical contract details"
      description="On-chain contracts and referral information"
    >
      <dl className="divide-y divide-border/60">
        {addresses.map(({ label, address }) => (
          <div
            key={label}
            className="grid min-w-0 gap-1.5 py-3 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-5"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="min-w-0">
              <AddressValue address={address} chainId={chainId} />
            </dd>
          </div>
        ))}
        <div className="grid gap-1.5 pt-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-5">
          <dt className="text-xs text-muted-foreground">Referrer share</dt>
          <dd className="text-sm tabular-nums">
            {Number.isFinite(witness.exchange.share) ? (
              <Amount
                amount={BN(witness.exchange.share).times(100).toFixed()}
                suffix="%"
              />
            ) : (
              "Not reported"
            )}
          </dd>
        </div>
      </dl>
    </DetailsDisclosure>
  );
}
