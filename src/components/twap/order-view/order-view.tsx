"use client";

import { Address, TokenAddress } from "@/components/token-address";
import { TokenAmount, TokenAmountFormatted } from "@/components/token-amount";
import { TransactionDisplay } from "@/components/transaction-display";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import {
  Partner as PartnerType,
  TwapConfig,
  Token,
  SpotOrderType,
} from "@/lib/types";
import { Order } from "@/lib/types";
import {
  abbreviate,
  formatDuration,
  getOrderProgress,
  parseOrderStatus,
  shortenAddress,
  toMoment,
} from "@/lib/utils/utils";

import moment from "moment";
import { createContext, useContext, useMemo, useState } from "react";
import { Copy } from "../../ui/copy";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { OrderChunks } from "./chunks";
import BN from "bignumber.js";
import {
  AlertTriangle,
  Clock,
  Code,
  Maximize2,
  Minimize2,
  Receipt,
  RefreshCw,
  Settings,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Network } from "@/components/ui/network";
import { Partner } from "@/components/ui/partner";
import { OrderStatusBadge } from "../order-status-badge";

import { useSpotOrder } from "@/lib/hooks/twap-hooks/use-spot-order";
import { OrderViewContext } from "./context";
import { useOrderViewContext } from "./use-order-view-context";
import { SpotOrderUiLogs } from "./ui-logs";
import { OriginalOrder } from "./original-order";

export function OrderView({ hash }: { hash: string }) {
  const orderPayload = useSpotOrder(hash);

  if (orderPayload.isLoading) {
    return (
      <TransactionDisplay.Container>
        <TransactionDisplay.Loading message="Loading order..." />
      </TransactionDisplay.Container>
    );
  }

  if (!orderPayload.originalOrder) {
    return (
      <TransactionDisplay.Container>
        <TransactionDisplay.NotFound
          title="Order Not Found"
          description="The TWAP order you're looking for doesn't exist."
        />
      </TransactionDisplay.Container>
    );
  }

  return (
    <OrderViewContext.Provider
      value={{ ...orderPayload, order: orderPayload.originalOrder! }}
    >
      <TransactionDisplay.Container>
        <TransactionDisplay.ContainerHeader />
        <OrderHeader />
        <FailureReason />
        <TransactionDisplay.Grid>
          <BaseInformation />
          <OrderConfig />
        </TransactionDisplay.Grid>
        <ExecutionDetails />
      </TransactionDisplay.Container>
    </OrderViewContext.Provider>
  );
}

const PriceRate = ({ rate, srcToken, chainId, dstToken }: { rate: string, srcToken: Token | undefined, chainId: number | undefined, dstToken: Token | undefined }) => {
  return (
    <div className="flex items-center gap-1 text-[12px]">
      <span className="text-secondary-foreground font-mono">
        {"1"}
      </span>
      <TokenAddress address={srcToken?.address} chainId={chainId} />
      <span className="text-secondary-foreground font-mono font-bold">
        {"="}
      </span>
      <TokenAmountFormatted amount={rate} token={dstToken} chainId={chainId} />
    </div>
  );
};


const LimitPrice = () => {
  const { srcToken, dstToken, limitPrice, chainId } = useOrderViewContext();

  return (
    <TransactionDisplay.SectionItem label="Limit Price" missingValue={!limitPrice.formatted}>
      <PriceRate rate={limitPrice.formatted} srcToken={srcToken} chainId={chainId} dstToken={dstToken} />
    </TransactionDisplay.SectionItem>
  );
};






const OrderHeader = () => {
  const { type, createdAt, status, srcToken, dstToken, chainId } =
    useOrderViewContext();

  return (
    <TransactionDisplay.Hero>
      <div className="flex flex-col gap-4">
        {/* Status & Type Badges */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {status && <OrderStatusBadge status={status} statusOnly />}
            <TransactionDisplay.Badge variant="muted">
              {type}
            </TransactionDisplay.Badge>
          </div>
          <div className="flex items-center gap-2">
            <OriginalOrder />
            <SpotOrderUiLogs />
           
          </div>
        </div>
        <OrderHash />
        {/* Swap Visual with Progress */}
        <div className="flex items-center gap-4 flex-wrap">
          
          <TransactionDisplay.SwapDirection
            fromAddress={srcToken?.address}
            toAddress={dstToken?.address}
            chainId={chainId}
          />
        </div>
      </div>
    </TransactionDisplay.Hero>
  );
};

const FailureReason = () => {
  const {status, description } = useOrderViewContext();

  const isFailed =
    status === "failed" || status === "expired" || status === "canceled";

  if (!isFailed) return null;

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-red-500/10">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-red-500">Order Failed</h3>
          {description && (
            <p className="text-sm text-muted-foreground capitalize">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const OrderHash = () => {
  const { hash } = useOrderViewContext();
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">ID:</span> <Copy text={shortenAddress(hash!)} value={hash!} tooltip={hash} />
    </div>
  );
};

const NetworkSection = () => {
  const { chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Network">
      <Network chainId={chainId || 0} />
    </TransactionDisplay.SectionItem>
  );
};

const PartnerSection = () => {
  const { partner } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Partner">
      <Partner data={partner || undefined} />
    </TransactionDisplay.SectionItem>
  );
};

const InTokenSection = () => {
  const { srcToken, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="In Token">
      <TokenAddress address={srcToken?.address} chainId={chainId} />
    </TransactionDisplay.SectionItem>
  );
};

const OutTokenSection = () => {
  const { dstToken, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Out Token">
      <TokenAddress address={dstToken?.address} chainId={chainId} />
    </TransactionDisplay.SectionItem>
  );
};

const SwapperSection = () => {
  const { swapper, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Swapper">
      <div className="flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
        <Address address={swapper} chainId={chainId} />
      </div>
    </TransactionDisplay.SectionItem>
  );
};


const TriggerPrice = () => {
  const { type, chainId, triggerPrice, dstToken } = useOrderViewContext();
  if (type !== SpotOrderType.TAKE_PROFIT) return null;
  return (
    <TransactionDisplay.SectionItem label="Trigger Price">
      <TokenAmount
        amountRaw={triggerPrice.raw}
        address={dstToken?.address}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};

const CreatedAtSection = () => {
  const { createdAt } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Created At">
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[13px] font-mono">{createdAt.format("lll")}</span>
      </div>
    </TransactionDisplay.SectionItem>
  );
};

const DeadlineSection = () => {
    const { expiration } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Deadline">
      <div className="flex items-center gap-2">
        <Timer className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[13px] font-mono">{expiration.format("lll")}</span>
      </div>
    </TransactionDisplay.SectionItem>
  );
};

const InAmountSection = () => {
  const { chainId, totalInAmount, srcToken } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="In Amount">
      <TokenAmount
        amountRaw={totalInAmount.raw}
        address={srcToken?.address}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};

const MinOutAmountSection = () => {
  const { chainId, minOutAmount, dstToken } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Min Out Amount">
      <TokenAmount
        amountRaw={minOutAmount.raw}
        address={dstToken?.address}
        chainId={chainId}
      />
    </TransactionDisplay.SectionItem>
  );
};

const FillDelaySection = () => {
  const { epoch } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Fill Delay">
      <span className="px-2 py-0.5 bg-muted rounded text-sm font-mono">
        {formatDuration(epoch)}
      </span>
    </TransactionDisplay.SectionItem>
  );
};


const SrcChunkAmount = () => {
  const { chainId, chunkAmount, srcToken, totalChunks } = useOrderViewContext();

  if (totalChunks === 1) return null;

  return (
    <TransactionDisplay.SectionItem label="Chunk Amount">
      <TokenAmount
        amountRaw={chunkAmount.raw}
        address={srcToken?.address}
        chainId={chainId}
      />
    </TransactionDisplay.SectionItem>
  );
};

const ExecutionDetails = () => {
  const { order, chainId } = useOrderViewContext();
  const progress = getOrderProgress(order);

  return (
    <TransactionDisplay.SectionCard title="Execution Details" icon={TrendingUp}>
      {/* Progress Bar */}
      <TransactionDisplay.ProgressBar
        progress={progress}
        label="Execution Progress"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Filled Amounts */}
        <TransactionDisplay.InfoBox>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Filled Amounts
          </h4>
          <div className="flex flex-col gap-3">
            <FilledSrcAmount />
            <FilledDstAmount />
          </div>
        </TransactionDisplay.InfoBox>

        {/* Fees & Rate */}
        <TransactionDisplay.InfoBox>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Fees & Rate
          </h4>
          <div className="flex flex-col gap-3">
            <FilledFee />
            <ExecutionRate />
          </div>
        </TransactionDisplay.InfoBox>
      </div>
    </TransactionDisplay.SectionCard>
  );
};

const FilledFee = () => {
  const { feeUsd } = useOrderViewContext();

  return (
    <TransactionDisplay.SectionItem label="Fee">
      <>${abbreviate(feeUsd, 2)}</>
    </TransactionDisplay.SectionItem>
  );
};

const FilledDstAmount = () => {
  const { order, chainId, dstFilledAmount } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Out Filled Amount">
      <TokenAmount
        amountRaw={dstFilledAmount.raw}
        address={order.order.witness.output.token}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};
const FilledSrcAmount = () => {
  const { order, chainId, srcFilledAmount } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="In Filled Amount">
      <TokenAmount
        amountRaw={srcFilledAmount.raw}
        address={order.order.witness.input.token}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};

const ExecutionRate = () => {
  const { srcToken, chainId, executionRate, dstToken } = useOrderViewContext();


  return (
    <TransactionDisplay.SectionItem label="Execution Rate" missingValue={!executionRate.formatted}>
      <PriceRate 
        rate={executionRate.formatted}
        srcToken={srcToken}
        chainId={chainId}
        dstToken={dstToken}
      />
    </TransactionDisplay.SectionItem>
  );
};



const BaseInformation = () => {
  return (
    <TransactionDisplay.SectionCard title="Order Details" icon={Receipt}>
       <CreatedAtSection />
       <DeadlineSection />
    
      <NetworkSection />
      <PartnerSection />
      <InAmountSection />
      <SrcChunkAmount />
      <MinOutAmountSection />
      <TriggerPrice />
      <FillDelaySection />
      <OrderChunks />
      <LimitPrice />
      <SwapperSection />

    </TransactionDisplay.SectionCard>
  );
};



const OrderConfig = () => {
  return (
    <TransactionDisplay.SectionCard title="Order Configuration" icon={Settings}>
  
    </TransactionDisplay.SectionCard>
  );
};

