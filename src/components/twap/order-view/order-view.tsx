"use client";

import { TokenDisplay } from "@/components/token-display";
import { TokenAmount, TokenAmountFormatted } from "@/components/token-amount";
import { TransactionDisplay } from "@/components/transaction-display";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import { Token, SpotOrderType, ChunkStatus } from "@/lib/types";
import { Amount } from "@/components/ui/amount";
import {
  formatDuration,
  getOrderProgress,
  parseOrderStatus,
  shortenAddress,
  toMoment,
} from "@/lib/utils/utils";

import moment from "moment";
import { Copy } from "../../ui/copy";
import { OrderChunks } from "./order-chunks";
import BN from "bignumber.js";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code,
  Hash,
  PlayCircle,
  Receipt,
  Settings,
  Timer,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { Network } from "@/components/ui/network";
import { Partner } from "@/components/ui/partner";
import { OrderStatusBadge } from "../order-status-badge";

import { useSpotOrder } from "@/lib/hooks/twap-hooks/use-spot-order";
import { OrderViewContext } from "./context";
import { useOrderViewContext } from "./use-order-view-context";
import { SpotOrderUiLogs } from "./ui-logs";
import { OriginalOrder } from "./original-order";
import { parseOrderType } from "@/lib/utils/spot-utils";
import { useSearchParams } from "next/navigation";
import { ExplorerLink } from "@/components/explorer-link";


const PriceRate = ({
  rate,
  srcToken,
  chainId,
  dstToken,
}: {
  rate: string;
  srcToken: Token | undefined;
  chainId: number | undefined;
  dstToken: Token | undefined;
}) => {
  return (
    <div className="flex items-center gap-1 text-[12px]">
      <span className="text-secondary-foreground font-mono">{"1"}</span>
      <TokenDisplay address={srcToken?.address} chainId={chainId} />
      <span className="text-secondary-foreground font-mono font-bold">
        {"="}
      </span>
      <TokenAmountFormatted amount={rate} token={dstToken} chainId={chainId} />
    </div>
  );
};


const ORDER_STATUS_VISUAL = {
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    sublabel: "All chunks filled",
    className: "border-emerald-500/40 bg-emerald-500/10",
    iconClassName: "text-emerald-500",
    labelClassName: "text-emerald-700 dark:text-emerald-400",
  },
  pending: {
    icon: PlayCircle,
    label: "In Progress",
    sublabel: "Chunks filling",
    className: "border-blue-500/40 bg-blue-500/10",
    iconClassName: "text-blue-500",
    labelClassName: "text-blue-700 dark:text-blue-400",
  },
  open: {
    icon: PlayCircle,
    label: "In Progress",
    sublabel: "Chunks filling",
    className: "border-blue-500/40 bg-blue-500/10",
    iconClassName: "text-blue-500",
    labelClassName: "text-blue-700 dark:text-blue-400",
  },
  partially_completed: {
    icon: CheckCircle2,
    label: "Partially Completed",
    sublabel: "Some chunks filled",
    className: "border-amber-500/40 bg-amber-500/10",
    iconClassName: "text-amber-500",
    labelClassName: "text-amber-700 dark:text-amber-400",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    sublabel: "Order did not complete",
    className: "border-red-500/40 bg-red-500/10",
    iconClassName: "text-red-500",
    labelClassName: "text-red-700 dark:text-red-400",
  },
  canceled: {
    icon: XCircle,
    label: "Canceled",
    sublabel: "Order was canceled",
    className: "border-red-500/30 bg-red-500/5",
    iconClassName: "text-red-500/90",
    labelClassName: "text-red-700/90 dark:text-red-400/90",
  },
  cancelled: {
    icon: XCircle,
    label: "Canceled",
    sublabel: "Order was canceled",
    className: "border-red-500/30 bg-red-500/5",
    iconClassName: "text-red-500/90",
    labelClassName: "text-red-700/90 dark:text-red-400/90",
  },
  expired: {
    icon: Clock,
    label: "Expired",
    sublabel: "Order deadline passed",
    className: "border-orange-500/40 bg-orange-500/10",
    iconClassName: "text-orange-500",
    labelClassName: "text-orange-700 dark:text-orange-400",
  },
} as const;

const DEFAULT_STATUS_VISUAL = {
  icon: Receipt,
  label: "Order",
  sublabel: "",
  className: "border-border bg-muted/50",
  iconClassName: "text-muted-foreground",
  labelClassName: "text-foreground",
};

const OrderHeader = () => {
  const { type, status, srcToken, dstToken, chainId, originalOrder, hash } =
    useOrderViewContext();
  const searchParams = useSearchParams();
  const isDev = searchParams.get("dev") === "true";

  const normalizedStatus = (status ?? "").toLowerCase().replace(/^cancelled$/, "canceled");
  const visual =
    ORDER_STATUS_VISUAL[normalizedStatus as keyof typeof ORDER_STATUS_VISUAL] ??
    DEFAULT_STATUS_VISUAL;
  const StatusIcon = visual.icon;

  const totalChunks = originalOrder?.metadata?.expectedChunks ?? 0;
  const filledChunks =
    originalOrder?.metadata?.chunks?.filter((c) => c.status === ChunkStatus.SUCCESS).length ?? 0;
  const showChunkProgress =
    totalChunks > 0 &&
    ["pending", "open", "partially_completed", "completed"].includes(normalizedStatus);

  return (
    <TransactionDisplay.Hero>
      <div className="flex flex-col gap-4">
        {/* Prominent status card - always show so status is visible */}
        <div
            className={`flex flex-wrap items-start gap-3 sm:gap-4 rounded-xl border p-3 sm:p-4 ${visual.className}`}
          >
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-background/80 border border-inherit">
              <StatusIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${visual.iconClassName}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm sm:text-base font-semibold ${visual.labelClassName}`}>
                {visual.label}
              </p>
              <span className="text-[14px] text-muted-foreground">
              {parseOrderType(type)} Order
              </span>
              {showChunkProgress && (
                <p className="text-xs sm:text-sm font-mono text-muted-foreground mt-1">
                  {filledChunks} / {totalChunks} chunks filled
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
              {hash && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/60 border border-inherit min-w-0">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Copy text={shortenAddress(hash, 8)} value={hash} tooltip={hash} />
                </div>
              )}

              {isDev && (
                <>
                  <OriginalOrder />
                  <SpotOrderUiLogs />
                </>
              )}
            </div>
          </div>
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


const Reactor = () => {
  const { order, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Reactor">
      <ExplorerLink value={order.order.witness.reactor} chainId={chainId} />
    </TransactionDisplay.SectionItem>
  );
};


const Executor = () => {
  const { order, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Executor">
      <ExplorerLink value={order.order.witness.executor} chainId={chainId} />
    </TransactionDisplay.SectionItem>
  );
};


const ExchangeAdapter = () => {
  const { order, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Exchange Adapter">
      <ExplorerLink value={order.order.witness.exchange.adapter} chainId={chainId} />
    </TransactionDisplay.SectionItem>
  );
};

const ExchangeReferrer = () => {
  const { order, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Exchange Referrer">
      <ExplorerLink value={order.order.witness.exchange.ref} chainId={chainId} />
    </TransactionDisplay.SectionItem>
  );
};

const ReferrerShare = () => {
  const { order } = useOrderViewContext();
  const valueF = useFormatNumber({value: order.order.witness.exchange.share * 100, decimalScale: 2})
  return (
    <TransactionDisplay.SectionItem label="Referrer Share">
      <span className="text-[13px] font-mono">{valueF}%</span>
    </TransactionDisplay.SectionItem>
  );
};


const SwapperSection = () => {
  const { swapper, chainId } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Swapper">
      <div className="flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
        <ExplorerLink value={swapper} chainId={chainId} />
      </div>
    </TransactionDisplay.SectionItem>
  );
};

const ExpectedAmountOut = () => {
  const { type, chainId, totalExpectedAmountOut, dstToken } = useOrderViewContext();
  if (type === SpotOrderType.TAKE_PROFIT) return null;
  return (
    <TransactionDisplay.SectionItem label="Expected Amount Out">
      <TokenAmountFormatted
        amount={totalExpectedAmountOut.formatted}
        token={dstToken}
        chainId={chainId}
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
        <span className="text-[13px] font-mono">
          {expiration.format("lll")}
        </span>
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
  const { chainId, totalMinOutAmount, dstToken } = useOrderViewContext();
  if (BN(totalMinOutAmount.formatted).isZero()) return null;
  return (
    <TransactionDisplay.SectionItem label="Min Out Amount">
      <TokenAmountFormatted
        amount={totalMinOutAmount.formatted}
        token={dstToken}
        chainId={chainId}
      />
    </TransactionDisplay.SectionItem>
  );
};

const FillDelaySection = () => {
  const { epoch } = useOrderViewContext();
  if (BN(epoch).isZero()) return null;
  return (
    <TransactionDisplay.SectionItem label="Fill Delay" missingValue={BN(epoch).isZero()}>
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

const FilledFee = () => {
  const { feeUsd } = useOrderViewContext();

  return (
    <TransactionDisplay.SectionItem label="Fee" missingValue={BN(feeUsd).isZero()}>
      <Amount amount={String(feeUsd)} prefix="$" />
    </TransactionDisplay.SectionItem>
  );
};

const FilledDstAmount = () => {
  const { order, chainId, dstFilledAmount } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Out Filled Amount"
    missingValue={BN(dstFilledAmount.formatted).isZero()}
    >
      <TokenAmount
        amountRaw={dstFilledAmount.raw}
        address={order.order.witness.output.token}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};


const OrderTypeSection = () => {
  const { type } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem label="Order Type">
     {parseOrderType(type)}
    </TransactionDisplay.SectionItem>
  );
};

const FilledSrcAmount = () => {
  const { order, chainId, srcFilledAmount } = useOrderViewContext();
  return (
    <TransactionDisplay.SectionItem
      label="In Filled Amount"
      missingValue={BN(srcFilledAmount.formatted).isZero()}
    >
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
    <TransactionDisplay.SectionItem
      label="Execution Rate"
      missingValue={BN(executionRate || 0).isZero()}
    >
      <PriceRate
        rate={executionRate}
        srcToken={srcToken}
        chainId={chainId}
        dstToken={dstToken}
      />
    </TransactionDisplay.SectionItem>
  );
};


const LimitPriceRate = () => {
  const { srcToken, chainId, limitPriceRate, dstToken } = useOrderViewContext();
  
  if (BN(limitPriceRate || 0).isZero()) return null;

  return (
    <TransactionDisplay.SectionItem
      label="Limit Price Rate"
      missingValue={BN(limitPriceRate || 0).isZero()}
    >
      <PriceRate
        rate={limitPriceRate}
        srcToken={srcToken}
        chainId={chainId}
        dstToken={dstToken}
      />
    </TransactionDisplay.SectionItem>
  );
};

const TriggerPriceRate = () => {
  const { srcToken, chainId, triggerPriceRate, dstToken } = useOrderViewContext();
  
  if (BN(triggerPriceRate || 0).isZero()) return null;
  return (
    <TransactionDisplay.SectionItem
      label="Trigger Price Rate"
    >
      <PriceRate
        rate={triggerPriceRate}
        srcToken={srcToken}
        chainId={chainId}
        dstToken={dstToken}
      />
    </TransactionDisplay.SectionItem>
  );
};

/** When, where, who — created, deadline, network, partner, swapper */
const OrderDetails = () => {
  return (
    <TransactionDisplay.SectionCard title="Details" icon={Receipt}>
      <CreatedAtSection />
      <DeadlineSection />
      <NetworkSection />
      <PartnerSection />
      <SwapperSection />
    </TransactionDisplay.SectionCard>
  );
};

const ContractAddresses = () => {
  return (
    <TransactionDisplay.SectionCard title="Contract Addresses" icon={Receipt}>
      <Reactor />
      <Executor />
      <ExchangeAdapter />
      <ExchangeReferrer />
      <ReferrerShare />
    </TransactionDisplay.SectionCard>
  );
};

/** What you're trading and on what conditions — amounts, price, chunks, fills */
const OrderTerms = () => {
  return (
    <TransactionDisplay.SectionCard title="Terms" icon={Settings}>
      <OrderTypeSection />
      <InAmountSection />
      <SrcChunkAmount />
      <ExpectedAmountOut />
      <MinOutAmountSection />
      <TriggerPriceRate />
      <FillDelaySection />
      <OrderChunks />
    </TransactionDisplay.SectionCard>
  );
};



const ExecutionDetails = () => {
  const { order } = useOrderViewContext();
  const progress = getOrderProgress(order);

  return (
    <TransactionDisplay.SectionCard title="Execution Details" icon={TrendingUp}>

      <TransactionDisplay.ProgressBar
        progress={progress}
        label="Execution Progress"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
        <TransactionDisplay.ContainerHeader
          backHref={backHref}
          defaultBackHref={defaultBackHref}
        />
        <OrderHeader />
        <TransactionDisplay.Grid>
          {/* When, where, who — context & identity */}
          <OrderDetails />
          {/* What you're trading and on what conditions */}
          <OrderTerms />
        </TransactionDisplay.Grid>
        {/* How the order is executing */}
        <ExecutionDetails />
        <ContractAddresses />
      </TransactionDisplay.Container>
    </OrderViewContext.Provider>
  );
}
