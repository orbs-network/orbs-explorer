import { Address } from "@/components/token-address";
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
import { ParsedOrderChunk } from "@/lib/types";
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
} from "lucide-react";
import { useSpotOrderChunks } from "@/lib/hooks/twap-hooks/use-spot-order-chunks";
import { useOrderViewContext } from "./use-order-view-context";
import { useMemo } from "react";
import { useFormatNumber } from "@/lib/hooks/use-number-format";


const PercentageDiff = ({ diff = '0' }: { diff?: string }) => {
  const valueF = useFormatNumber({
    value: diff,
    decimalScale: 2,
    prefix: "",
    suffix: "%",
  })
  return (
    <>
    {valueF}
    </>
  );
};

/** Renders full chunk details; only shows fields that have values. */
function ChunkDetailsSection({ chunk }: { chunk: ParsedOrderChunk }) {
  const sections: {
    title: string;
    rows: { label: string; value: React.ReactNode }[];
  }[] = useMemo(() => {
    return [
      {
        title: "",
        rows: [
          {
            label: "Created at",
            value: chunk.createdAt
              ? toMoment(chunk.createdAt).format("lll")
              : null,
          },
          {
            label: "Updated at",
            value: chunk.updatedAt
              ? toMoment(chunk.updatedAt).format("lll")
              : null,
          },
          {
            label: "Due time",
            value: chunk.dueTime ? toMoment(chunk.dueTime).format("lll") : null,
          },
        ],
      },
      {
        title: "Fill Details",
        rows: [
          {
            label: "Block",
            value: chunk.blockId != null ? String(chunk.blockId) : null,
          },
          {
            label: "Tx Hash",
            value: chunk.txHash ? (
              <Address address={chunk.txHash} chainId={chunk.chainId || 0} />
            ) : null,
          },
          {
            label: "Executor",
            value: chunk.executor ? (
              <Address address={chunk.executor} chainId={chunk.chainId || 0} />
            ) : null,
          },
          {
            label: "Swapper",
            value: chunk.swapper ? (
              <Address address={chunk.swapper} chainId={chunk.chainId || 0} />
            ) : null,
          },
        ],
      },
      {
        title: "Settlement Details",
        rows: [
          {
            label: "Input Amount:",
            value: chunk.inAmount ? <TokenAmount amountRaw={chunk.inAmount} address={chunk.inToken?.address} chainId={chunk.chainId || 0} /> : null,
          },
          {
            label: "Output Amount:",
            value: chunk.outAmount ? <TokenAmount amountRaw={chunk.outAmount} address={chunk.outToken?.address} chainId={chunk.chainId || 0} /> : null,
          },
          {
            label: "Min Output Amount:",
            value: chunk.minOut ? <TokenAmount amountRaw={chunk.minOut} address={chunk.outToken?.address} chainId={chunk.chainId || 0} /> : null,
          },
          {
            label: "Exchange:",
            value: chunk.exchange ? <Address address={chunk.exchange} chainId={chunk.chainId || 0} /> : null,
          },

        ],
      },
      {
        title: "Oracle Details",
        rows: [
          {
            label: "Name:",
            value: chunk.oracleName ? chunk.oracleName : null,
          },
          {
            label: "Timestamp:",
            value: chunk.oracleTimestamp ? toMoment(chunk.oracleTimestamp).format("lll") : null,
          },
          {
            label: "Input Token Price:",
            value: chunk.inputTokenUsd ? abbreviate(chunk.inputTokenUsd) : null,
          },
          {
            label: "Output Token Price:",
            value: chunk.outputTokenUsd ? abbreviate(chunk.outputTokenUsd) : null,
          },

          {
            label: "Expected Output Oracle:",
            value: <TokenAmount amountRaw={chunk.expectedOutputOracle} address={chunk.outToken?.address} chainId={chunk.chainId || 0} />,
          },
          {
            label: `Expected Output Solver (${chunk.solverName})`,
            value: <div className="flex items-center gap-1">
              <TokenAmount amountRaw={chunk.solverOutAmount} address={chunk.outToken?.address} chainId={chunk.chainId || 0} />
              <span>
                (<PercentageDiff diff={chunk.outAmountDiff} />)
              </span>
            </div>,
          },
          {
            label:'Exchange Rate:',
            value: <div className="flex items-center gap-1">
                <TokenAmountFormatted amount='1' token={chunk.inToken} chainId={chunk.chainId || 0} usd='' />
                <span className="text-secondary-foreground font-mono font-bold">=</span>
                <TokenAmountFormatted amount={chunk.exchangeRate ?? '0'} token={chunk.outToken} chainId={chunk.chainId || 0} usd='' />
            </div>,
          },
          {
            label:'Expected Output:',
            value: <TokenAmount amountRaw={chunk.expectedOutputOracle} address={chunk.outToken?.address} chainId={chunk.chainId || 0} />,
          },
          {
            label:'Value in USD:',
            value: <span>
              {abbreviate(chunk.inputTotalUsd ?? '0')}{" "}
              worth of {chunk.inToken?.symbol} = {abbreviate(chunk.outputTotalUsd ?? '0')} {chunk.outToken?.symbol}
            </span>

          }
        ],
      },
    ];
  }, [chunk]);

  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Chunk details
        </span>
      </div>
      {sections.map(({ title, rows }) => (
        <div key={title} className="mt-4 pt-3 border-t border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
            {title}
          </span>
          {rows.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {label}
              </dt>
              <dd className="font-mono text-foreground text-xs break-all tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </div>
      ))}
      {chunk.txHash && chunk.txHash !== "0x" && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
            Tx hash
          </span>
          <Address address={chunk.txHash} chainId={chunk.chainId || 0} />
        </div>
      )}
    </div>
  );
}

export function OrderChunks() {
  const { hash, status } = useOrderViewContext();
  const { chunks, isLoading } = useSpotOrderChunks(hash);
  if (isLoading || !chunks) return null;
  const { successChunks, failedChunks, pendingChunks, expectedChunks } = chunks;
  const orderCancelled = status === "cancelled";

  return (
    <TransactionDisplay.SectionItem label="Fills">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {orderCancelled ? (
              <XCircle className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            <span className="font-mono">
              {successChunks.length} / {expectedChunks}
            </span>
            {!orderCancelled &&
              successChunks.length === expectedChunks &&
              expectedChunks > 0 && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              )}
            {orderCancelled && (
              <span className="text-xs text-muted-foreground">cancelled</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[36rem] max-h-[85vh] overflow-y-auto rounded-2xl border-border/80">
          <DialogHeader className="space-y-1.5 pb-2">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              {orderCancelled ? "Order Fills (cancelled)" : "Order Fills"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground pl-11">
              {successChunks.length} of {expectedChunks} chunks filled
              {failedChunks.length > 0 && (
                <span className="text-destructive font-medium ml-1.5">
                  · {failedChunks.length} failed
                </span>
              )}
              {!orderCancelled && pendingChunks.length > 0 && (
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
                variant={orderCancelled ? "cancelled" : "pending"}
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
  const { srcToken, dstToken, chainId, chunkAmount, minOutAmountPerChunk } =
    useOrderViewContext();
  const readableDescription = formatChunkDescription(
    chunk.description,
    dstToken?.symbol,
  );
  const inTokenAddress = chunk.inToken?.address;
  const outTokenAddress = chunk.outToken?.address;
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
    <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-border/80 bg-card shadow-sm hover:border-primary/25 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          Chunk #{chunk.index}
        </span>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badgeStyles}`}
        >
          {isFailed ? (
            <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
          ) : isCancelled ? (
            <XCircle className={`w-3 h-3 shrink-0 ${iconColor}`} />
          ) : (
            <Loader2 className={`w-3 h-3 shrink-0 ${iconColor} animate-spin`} />
          )}
          <span className={labelColor}>{label}</span>
        </div>
      </div>
      {(inTokenAddress || outTokenAddress) && (
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Sell
            </span>
            <TokenAmount
              amountRaw={inAmountRaw}
              address={inTokenAddress}
              chainId={chunk.chainId ?? chainId ?? 0}
              usd=""
            />
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Buy
            </span>
            <TokenAmount
              amountRaw={outAmountRaw}
              address={outTokenAddress}
              chainId={chunk.chainId ?? chainId ?? 0}
              usd=""
            />
          </div>
        </div>
      )}
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
      <ChunkDetailsSection chunk={chunk} />
    </div>
  );
};

const ChunkCard = ({ chunk }: { chunk: ParsedOrderChunk }) => {
  const isSuccess = chunk.txHash && chunk.txHash !== "0x";

  if (!isSuccess) return null;

  return (
    <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-border/80 bg-card shadow-sm hover:border-primary/25 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          Chunk #{chunk.index}
        </span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-500/25 bg-green-500/10 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-500 shrink-0" />
          <span className="text-green-700 dark:text-green-400">Filled</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Sell
          </span>
          <TokenAmount
            amountRaw={chunk.inAmount}
            address={chunk.inToken?.address}
            chainId={chunk.chainId}
            usd=""
          />
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Buy
          </span>
          <TokenAmount
            amountRaw={chunk.outAmount}
            address={chunk.outToken?.address}
            chainId={chunk.chainId}
            usd=""
          />
        </div>
      </div>

      <ChunkDetailsSection chunk={chunk} />
    </div>
  );
};
