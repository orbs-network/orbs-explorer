import { Address } from "@/components/address";
import { TokenAmount, TokenAmountFormatted } from "@/components/token-amount";
import { TransactionDisplay } from "@/components/transaction-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ParsedOrderChunk, Token } from "@/lib/types";
import { abbreviate, formatUsd, toMoment } from "@/lib/utils/utils";
import { formatChunkDescription } from "@/lib/utils/spot-utils";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Loader2,
  ArrowRight,
  XCircle,
  FileText,
  ChevronDown,
  CheckIcon,
} from "lucide-react";
import { useSpotOrderChunks } from "@/lib/hooks/twap-hooks/use-spot-order-chunks";
import { createContext, useContext, useState } from "react";
import { useOrderViewContext } from "./use-order-view-context";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import BN from "bignumber.js";
import { useToUiAmount } from "@/lib/hooks/use-to-ui-amount";

const EMPTY = "—";

const ChunkDetailsContext = createContext<ParsedOrderChunk | null>(null);

function useChunkDetails() {
  const chunk = useContext(ChunkDetailsContext);
  if (!chunk) throw new Error("Chunk details field must be used inside ChunkDetailsSection");
  return chunk;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className="font-mono text-foreground text-[13px] break-all tabular-nums">
        {value ?? EMPTY}
      </dd>
    </div>
  );
}

function DetailSectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 pt-3 border-t border-border/60 [&:first-child]:mt-0 [&:first-child]:pt-0 [&:first-child]:border-t-0">
      <span className="text-[14px] font-medium text-muted-foreground uppercase tracking-wider block mb-2 bg-primary/10 px-2 py-1 rounded-md">
        {title}
      </span>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {children}
      </dl>
    </div>
  );
}

function CreatedAt() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Created at"
      value={chunk.createdAt != null ? toMoment(chunk.createdAt).format("lll") : null}
    />
  );
}
function UpdatedAt() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Updated at"
      value={chunk.updatedAt != null ? toMoment(chunk.updatedAt).format("lll") : null}
    />
  );
}
function DueTime() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Due time"
      value={chunk.dueTime != null ? toMoment(chunk.dueTime).format("lll") : null}
    />
  );
}
function Block() {
  const chunk = useChunkDetails();
  return (
    <DetailRow label="Block" value={chunk.blockId != null ? String(chunk.blockId) : null} />
  );
}
function TxHash() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Tx Hash"
      value={<Address address={chunk.txHash} chainId={chunk.chainId || 0} />}
    />
  );
}
function Executor() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Executor"
      value={<Address address={chunk.executor} chainId={chunk.chainId || 0} />}
    />
  );
}
function Swapper() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Swapper"
      value={<Address address={chunk.swapper} chainId={chunk.chainId || 0} />}
    />
  );
}
function InputAmount() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Input Amount"
      value={
        <TokenAmount
          amountRaw={chunk.inAmount}
          address={chunk.inToken?.address}
          chainId={chunk.chainId || 0}
        />
      }
    />
  );
}
function OutputAmount() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Output Amount"
      value={
        <TokenAmount
          amountRaw={chunk.outAmount}
          address={chunk.outToken?.address}
          chainId={chunk.chainId || 0}
        />
      }
    />
  );
}
function MinOutputAmount() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Min Output Amount"
      value={
        <TokenAmount
          amountRaw={chunk.minOut}
          address={chunk.outToken?.address}
          chainId={chunk.chainId || 0}
        />
      }
    />
  );
}
function Exchange() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Exchange"
      value={<Address address={chunk.exchange} chainId={chunk.chainId || 0} />}
    />
  );
}
function OracleName() {
  const chunk = useChunkDetails();
  return <DetailRow label="Name" value={chunk.oracleName ?? null} />;
}
function OracleTimestamp() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Timestamp"
      value={
        chunk.oracleTimestamp != null
          ? toMoment(chunk.oracleTimestamp).format("lll")
          : null
      }
    />
  );
}


const OracleAddress = () => {
  const chunk = useChunkDetails();
  return <DetailRow label="Address" value={
    <Address address={chunk.oracleAddress} chainId={chunk.chainId || 0} />
  } />;
}

const FeeOnTransfer = () => {
  const chunk = useChunkDetails();

  const value = useFormatNumber({
    value: useToUiAmount(chunk.inToken?.decimals, chunk.feeOnTransfer),
  })

  if(chunk.feeOnTransferError){
    return <div className="text-muted-foreground flex items-start gap-2 w-fit mt-4 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
      <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
      <p className="text-red-500 break-all flex-1">Transfer Fee Estimation Error: {chunk.feeOnTransferError}</p>
    </div>;
  }

  if(BN(chunk.feeOnTransfer).isZero()){

    return <div className="text-muted-foreground flex items-center gap-2 w-fit mt-4 text-xs bg-primary/10 border border-primary/20 px-4 py-1 rounded-md">
      <CheckIcon className="w-3.5 h-3.5 text-primary" />
      <span className="text-primary">No fee on transfer</span>
    </div>;
  }

  return (
    <DetailRow
      label="Fee on Transfer"
      value={value}
    />
  );
}



function InputTokenPrice() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label={`In Token Price (${chunk.inToken?.symbol})`}
      value={chunk.inputTokenUsd != null ? `$${abbreviate(chunk.inputTokenUsd)}` : null}
    />
  );
}
function OutputTokenPrice() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label={`Out Token Price (${chunk.outToken?.symbol})`}
      value={
        chunk.outputTokenUsd != null ? `$${abbreviate(chunk.outputTokenUsd)}` : null
      }
    />
  );
}
function ExchangeRate() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Rate"
      value={
        <div className="flex items-center gap-1">
          <TokenAmountFormatted
            amount="1"
            token={chunk.inToken}
            chainId={chunk.chainId || 0}
            usd=""
          />
          <span className="text-secondary-foreground font-mono font-bold">=</span>
          <TokenAmountFormatted
            amount={chunk.exchangeRate ?? "0"}
            token={chunk.outToken}
            chainId={chunk.chainId || 0}
            usd=""
          />
        </div>
      }
    />
  );
}
function ExpectedOutput() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Expected Output"
      value={
        <TokenAmount
          amountRaw={chunk.expectedOutputOracle}
          address={chunk.outToken?.address}
          chainId={chunk.chainId || 0}
        />
      }
    />
  );
}

function ChunkDetailsTimingSection() {
  return (
    <DetailSectionBlock title="Timing">
      <CreatedAt />
      <UpdatedAt />
      <DueTime />
    </DetailSectionBlock>
  );
}
function ChunkDetailsFillSection() {
  return (
    <DetailSectionBlock title="Fill">
      <Block />
      <TxHash />
      <Executor />
      <Swapper />
      <InputAmount />
      <OutputAmount />
      <MinOutputAmount />
      <Exchange />
    </DetailSectionBlock>
  );
}

function ChunkDetailsOracleSection() {
  return (
    <DetailSectionBlock title="Oracle & pricing">
      <OracleName />
      <OracleAddress />
      <OracleTimestamp />
      <InputTokenPrice />
      <OutputTokenPrice />
      <ExchangeRate />
      <ExpectedOutput />
    </DetailSectionBlock>
  );
}

function ChunkDetailsSection({ chunk }: { chunk: ParsedOrderChunk }) {
  return (
    <ChunkDetailsContext.Provider value={chunk}>
      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 mt-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Chunk details
          </span>
        </div>
        <div>
          <ChunkDetailsTimingSection />
          <ChunkDetailsOracleSection />

          <ChunkDetailsFillSection />
          <FeeOnTransfer />
        </div>
      </div>
    </ChunkDetailsContext.Provider>
  );
}

export function OrderChunks() {
  const { hash } = useOrderViewContext();
  const { chunks } = useSpotOrderChunks(hash);
  const { successChunks, failedChunks, pendingChunks, expectedChunks } = chunks;

  return (
    <TransactionDisplay.SectionItem label="Fills">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {failedChunks.length > 0 ? (
              <XCircle className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            <span className="font-mono">
              {successChunks.length} / {expectedChunks}
            </span>
            {failedChunks.length === 0 &&
              successChunks.length === expectedChunks &&
              expectedChunks > 0 && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              )}
            {failedChunks.length > 0 && (
              <span className="text-xs text-muted-foreground">cancelled</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[44rem] max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] overflow-y-auto rounded-2xl border-border/80">
          <DialogHeader className="space-y-1.5 pb-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              {failedChunks.length > 0
                ? "Order Fills (cancelled)"
                : "Order Fills"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground pl-11">
              {successChunks.length} of {expectedChunks} chunks filled
              {failedChunks.length > 0 && (
                <span className="text-destructive font-medium ml-1.5">
                  · {failedChunks.length} failed
                </span>
              )}
              {failedChunks.length === 0 && pendingChunks.length > 0 && (
                <span className="text-amber-600 dark:text-amber-500 font-medium ml-1.5">
                  · {pendingChunks.length} pending
                </span>
              )}
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {successChunks.map((chunk, index) => (
              <ChunkCard key={`success-${chunk.index}`} chunk={chunk} />
            ))}
            {pendingChunks.map((chunk) => (
              <ChunkCardPendingOrFailed
                key={`pending-${chunk.index}`}
                chunk={chunk}
                variant="pending"
              />
            ))}
            {failedChunks.map((chunk) => (
              <ChunkCardPendingOrFailed
                key={`failed-${chunk.index}`}
                chunk={chunk}
                variant="failed"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </TransactionDisplay.SectionItem>
  );
}

const ChunkCardPendingOrFailed = ({
  chunk,
  variant,
}: {
  chunk: ParsedOrderChunk;
  variant: "pending" | "failed" | "cancelled";
}) => {
  const { dstToken, chainId, chunkAmount, minOutAmountPerChunk } =
    useOrderViewContext();
  const readableDescription = formatChunkDescription(
    chunk.description,
    dstToken?.symbol,
  );
  const inAmountRaw =
    chunk.inAmount && chunk.inAmount !== "0"
      ? chunk.inAmount
      : (chunkAmount?.raw ?? "0");
  const outAmountRaw =
    chunk.outAmount && chunk.outAmount !== "0"
      ? chunk.outAmount
      : (minOutAmountPerChunk?.raw ?? "0");

  const isFailed = variant === "failed";
  const isCancelled = variant === "cancelled";

  const badgeStyles = isFailed
    ? "bg-red-500/10 border-red-500/20"
    : isCancelled
      ? "bg-muted border-border"
      : "bg-amber-500/10 border-amber-500/20";
  const iconColor = isFailed
    ? "text-red-500"
    : isCancelled
      ? "text-muted-foreground"
      : "text-amber-500";
  const labelColor = isFailed
    ? "text-red-500"
    : isCancelled
      ? "text-muted-foreground"
      : "text-amber-500";
  const label = isFailed ? "Failed" : isCancelled ? "Cancelled" : "Pending";

  return (
    <details className="group rounded-xl border border-border/80 bg-card shadow-sm hover:border-primary/25 transition-all duration-200 overflow-hidden">
      <summary className="flex flex-col items-start gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-muted/30 transition-colors">
        <div className="flex items-center justify-center gap-2 w-full">
          <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
            Chunk #{chunk.index}
          </span>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0 ${badgeStyles}`}
          >
            {isFailed ? (
              <AlertCircle className="w-3 h-3 text-red-500" />
            ) : isCancelled ? (
              <XCircle className={`w-3 h-3 ${iconColor}`} />
            ) : (
              <Loader2 className={`w-3 h-3 ${iconColor} animate-spin`} />
            )}
            <span className={labelColor}>{label}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180 ml-auto" />
        </div>
        <span className="min-w-0 flex-1 truncate text-right">
          <ChunkSummaryLine
            inAmount={inAmountRaw}
            inToken={chunk.inToken}
            outAmount={outAmountRaw}
            outToken={chunk.outToken}
            chainId={chunk.chainId ?? chainId ?? 0}
          />
        </span>
      </summary>
      <div className="px-4 pb-4 pt-0 flex flex-col gap-3.5 border-t border-border/60">
        {readableDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {readableDescription}
          </p>
        )}
        {chunk.dueTime && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Due: {toMoment(chunk.dueTime).format("lll")}</span>
          </div>
        )}
      </div>
    </details>
  );
};

function ChunkSummaryLine({
  inAmount,
  inToken,
  outAmount,
  outToken,
  chainId,
}: {
  inAmount: string;
  inToken?: Token;
  outAmount: string;
  outToken?: Token;
  chainId?: number;
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Sell
        </span>
        <TokenAmount
          amountRaw={inAmount}
          address={inToken?.address}
          chainId={chainId ?? 0}
          usd=""
        />
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Buy
        </span>
        <TokenAmount
          amountRaw={outAmount}
          address={outToken?.address}
          chainId={chainId ?? 0}
          usd=""
        />
      </div>
    </div>
  );
}

const ChunkCard = ({ chunk }: { chunk: ParsedOrderChunk }) => {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="group rounded-xl border border-border/80 bg-card shadow-sm hover:border-primary/25 transition-all duration-200 overflow-hidden"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex gap-3 px-4 py-3 cursor-pointer list-none select-none hover:bg-muted/30 transition-colors flex-col items-start justify-start">
        <div className="flex items-center gap-3 justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
              Chunk #{chunk.index}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-500/25 bg-green-500/10 text-xs font-medium shrink-0">
              <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-500" />
              <span className="text-green-700 dark:text-green-400">Filled</span>
            </div>
            <span className="text-muted-foreground tabular-nums shrink-0 text-right bg-muted/40 border border-border/50 px-2 py-1 rounded-md text-xs">
              {toMoment(chunk.createdAt).format("lll")}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180" />
        </div>
        <span className="min-w-0 flex-1 truncate text-right">
          <ChunkSummaryLine
            inAmount={chunk.inAmount ?? "0"}
            inToken={chunk.inToken}
            outAmount={chunk.outAmount ?? "0"}
            outToken={chunk.outToken}
            chainId={chunk.chainId ?? 0}
          />
        </span>
      </summary>
      {open && (
        <div className="px-4 pb-4 pt-0 flex flex-col gap-3.5 border-t border-border/60">
          <ChunkDetailsSection chunk={chunk} />
        </div>
      )}
    </details>
  );
};
