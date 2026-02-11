"use client";

import { Address, TokenAddress } from "@/components/token-address";
import { TokenAmount } from "@/components/token-amount";
import { TransactionDisplay } from "@/components/transaction-display";

import {
  useOrder,
  useOrderExecutionRate,
  useOrderFilledAmounts,
  useOrderLimitPriceRate,
} from "@/lib/hooks/twap-hooks";
import { useNetwork } from "@/lib/hooks/use-network";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import { Partner as PartnerType, TwapConfig, Token } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import dynamic from "next/dynamic";

const ReactJson = dynamic(() => import("react-json-view"), { ssr: false });

type ContextType = {
  order: Order;
  isLoading: boolean;
  srcToken?: Token;
  dstToken?: Token;
  partner?: PartnerType | null;
  chainId?: number;
  config?: TwapConfig | null;
};

const Context = createContext<ContextType>({} as ContextType);
const usePageContext = () => {
  return useContext(Context);
};

export function OrderView({ hash }: { hash: string }) {
  const { order, isLoading, srcToken, dstToken, partner, chainId, config } =
    useOrder(hash);

  if (isLoading) {
    return (
      <TransactionDisplay.Container>
        <TransactionDisplay.Loading message="Loading order..." />
      </TransactionDisplay.Container>
    );
  }

  if (!order) {
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
    <Context.Provider
      value={{ order, isLoading, srcToken, dstToken, partner, chainId, config }}
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
    </Context.Provider>
  );
}

const OrderHeader = () => {
  const { order, srcToken, dstToken, chainId } = usePageContext();

  return (
    <TransactionDisplay.Hero>
      <div className="flex flex-col gap-4">
        {/* Status & Type Badges */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.metadata.status} statusOnly />
            <TransactionDisplay.Badge variant="muted">
              {order.metadata.orderType}
            </TransactionDisplay.Badge>
          </div>
          <div className="flex items-center gap-2">
            <RawOrderButton />
            <TransactionDisplay.Timestamp
              date={toMoment(order.timestamp).toDate()}
            />
          </div>
        </div>

        {/* Swap Visual with Progress */}
        <div className="flex items-center gap-4 flex-wrap">
          <TransactionDisplay.SwapDirection
            fromAddress={order.order.witness.input.token}
            toAddress={order.order.witness.output.token}
            chainId={chainId}
          />
        </div>
      </div>
    </TransactionDisplay.Hero>
  );
};

const RawOrderButton = () => {
  const { order } = usePageContext();
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Code className="w-3.5 h-3.5" />
          Raw Order
        </Button>
      </DialogTrigger>
      <DialogContent
        className={
          isFullscreen
            ? "!max-w-[95vw] !w-[95vw] !max-h-[95vh] !h-[95vh] overflow-hidden flex flex-col"
            : "!max-w-5xl !w-[90vw] !max-h-[80vh] overflow-hidden flex flex-col"
        }
      >
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle>Raw Order Data</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-lg bg-[#1e1e1e] p-4">
          <ReactJson
            src={order}
            theme="monokai"
            collapsed={2}
            displayDataTypes={false}
            enableClipboard
            style={{ backgroundColor: "transparent" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const FailureReason = () => {
  const { order } = usePageContext();

  const status = order.metadata.status?.toLowerCase();
  const isFailed =
    status === "failed" || status === "expired" || status === "canceled";

  if (!isFailed) return null;

  // Get the failure description from metadata
  const description = order.metadata.description;
  const displayOnlyStatus = order.metadata.displayOnlyStatus;
  // Check for failed chunks to get more details

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

const BaseInformation = () => {
  const { order, chainId, partner } = usePageContext();

  return (
    <TransactionDisplay.SectionCard title="Order Details" icon={Receipt}>
      <TransactionDisplay.SectionItem label="Order Hash">
        <Copy
          text={shortenAddress(order.hash)}
          value={order.hash}
          tooltip={order.hash}
        />
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="Network">
        <Network chainId={chainId || 0} />
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="Partner">
        <Partner data={partner || undefined} />
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="In Token">
        <TokenAddress
          address={order.order.witness.input.token}
          chainId={chainId}
        />
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="Out Token">
        <TokenAddress
          address={order.order.witness.output.token}
          chainId={chainId}
        />
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="Swapper">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
          <Address address={order.order.witness.swapper} chainId={chainId} />
        </div>
      </TransactionDisplay.SectionItem>
    </TransactionDisplay.SectionCard>
  );
};

const OrderConfig = () => {
  const { order, chainId } = usePageContext();

  return (
    <TransactionDisplay.SectionCard title="Order Configuration" icon={Settings}>
      <TransactionDisplay.SectionItem label="Created">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{toMoment(order.timestamp).format("lll")}</span>
        </div>
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="Deadline">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span>
            {moment(Number(order.order.witness.deadline) * 1000).format("lll")}
          </span>
        </div>
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="Total In Amount">
        <TokenAmount
          amountRaw={order.order.witness.input.amount}
          address={order.order.witness.input.token}
          chainId={chainId}
          usd=""
        />
      </TransactionDisplay.SectionItem>
      <TransactionDisplay.SectionItem label="Min Out Amount">
        <TokenAmount
          amountRaw={order.order.witness.output.limit}
          address={order.order.witness.output.token}
          chainId={chainId}
        />
      </TransactionDisplay.SectionItem>

      {order.order.witness.output.stop && (
        <TransactionDisplay.SectionItem label="Trigger Price">
          <TokenAmount
            amountRaw={order.order.witness.output.stop}
            address={order.order.witness.output.token}
            chainId={chainId}
            usd=""
          />
        </TransactionDisplay.SectionItem>
      )}
      <SrcChunkAmount />
      <TransactionDisplay.SectionItem label="Fill Delay">
        <span className="px-2 py-0.5 bg-muted rounded text-sm font-mono">
          {formatDuration(order.order.witness.epoch)}
        </span>
      </TransactionDisplay.SectionItem>
      <OrderChunks hash={order.hash} />
    </TransactionDisplay.SectionCard>
  );
};

const SrcChunkAmount = () => {
  const { order, chainId } = usePageContext();

  return (
    <TransactionDisplay.SectionItem label="Src Chunk Amount">
      <TokenAmount
        amountRaw={order?.order.witness.input.maxAmount}
        address={order.order.witness.input.token}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};

const ExecutionDetails = () => {
  const { order, chainId } = usePageContext();
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
  const { order } = usePageContext();
  const { feeUsd } = useOrderFilledAmounts(order);

  return (
    <TransactionDisplay.SectionItem label="Fee">
      <>${abbreviate(feeUsd, 2)}</>
    </TransactionDisplay.SectionItem>
  );
};

const FilledDstAmount = () => {
  const { order, chainId } = usePageContext();
  const { dstFilledAmountRaw } = useOrderFilledAmounts(order);
  return (
    <TransactionDisplay.SectionItem label="Out Filled Amount">
      <TokenAmount
        amountRaw={dstFilledAmountRaw}
        address={order.order.witness.output.token}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};
const FilledSrcAmount = () => {
  const { order, chainId } = usePageContext();
  const { srcFilledAmountRaw } = useOrderFilledAmounts(order);
  return (
    <TransactionDisplay.SectionItem label="In Filled Amount">
      <TokenAmount
        amountRaw={srcFilledAmountRaw}
        address={order.order.witness.input.token}
        chainId={chainId}
        usd=""
      />
    </TransactionDisplay.SectionItem>
  );
};

const ExecutionRate = () => {
  const { order, srcToken, chainId } = usePageContext();
  const { raw } = useOrderExecutionRate(order);

  const content = useMemo(() => {
    if (!raw) return <>-</>;

    return (
      <>
        <span className="text-secondary-foreground font-mono text-sm mr-2">
          {"1 "}
        </span>
        <TokenAddress
          address={order.order.witness.output.token}
          chainId={chainId}
        />
        <span className="text-secondary-foreground font-mono text-sm ml-2 font-bold">
          {" = "}
        </span>
        <TokenAmount
          className="ml-2"
          amountRaw={raw}
          address={order.order.witness.output.token}
          chainId={chainId}
          usd=""
        />
      </>
    );
  }, [raw]);

  return (
    <TransactionDisplay.SectionItem label="Execution Rate">
      {content}
    </TransactionDisplay.SectionItem>
  );
};

const LimitPrice = () => {
  const { order, srcToken, dstToken } = usePageContext();
  const { formatted } = useOrderLimitPriceRate(order);

  const limitPriceRateF = useFormatNumber({ value: formatted });
  if (!formatted) return null;

  return (
    <TransactionDisplay.SectionItem label="Limit Price">
      {!formatted
        ? "-"
        : `1 ${srcToken?.symbol} = ${limitPriceRateF} ${dstToken?.symbol}`}
    </TransactionDisplay.SectionItem>
  );
};
