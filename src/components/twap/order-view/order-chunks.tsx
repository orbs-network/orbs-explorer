import { Address } from "@/components/token-address";
import { TokenAmount } from "@/components/token-amount";
import { TransactionDisplay } from "@/components/transaction-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import { ParsedOrderChunk } from "@/lib/types";
import { toMoment } from "@/lib/utils/utils";
import { formatChunkDescription } from "@/lib/utils/spot-utils";
import {
  ArrowDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Loader2,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { useSpotOrderChunks } from "@/lib/hooks/twap-hooks/use-spot-order-chunks";
import { useOrderViewContext } from "./use-order-view-context";

const isOrderCancelled = (status: string) =>
  Boolean(status?.toLowerCase().includes("cancel"));

export function OrderChunks() {
  const { hash, status } = useOrderViewContext();
  const { chunks, isLoading } = useSpotOrderChunks(hash);
  if (isLoading || !chunks) return null;
  const { successChunks, failedChunks, pendingChunks, expectedChunks } = chunks;
  const orderCancelled = isOrderCancelled(status ?? "");

  return (
    <TransactionDisplay.SectionItem label={orderCancelled ? "Fills (cancelled)" : "Fills"}>
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
            {!orderCancelled && successChunks.length === expectedChunks && expectedChunks > 0 && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            )}
            {orderCancelled && (
              <span className="text-xs text-muted-foreground">cancelled</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              {orderCancelled ? "Order Fills (cancelled)" : "Order Fills"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {successChunks.length} of {expectedChunks} chunks filled
              {orderCancelled && (
                <span className="text-muted-foreground ml-2">(order cancelled)</span>
              )}
              {failedChunks.length > 0 && (
                <span className="text-red-500 ml-2">
                  ({failedChunks.length} failed)
                </span>
              )}
              {pendingChunks.length > 0 && (
                <span className={orderCancelled ? "text-muted-foreground ml-2" : "text-amber-500 ml-2"}>
                  ({pendingChunks.length} {orderCancelled ? "cancelled" : "pending"})
                </span>
              )}
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {successChunks.map((chunk, index) => (
              <ChunkCard
                key={`success-${chunk.index}`}
                chunk={chunk}
              />
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
  const inTokenAddress = chunk.inToken || srcToken?.address || "";
  const outTokenAddress = chunk.outToken || dstToken?.address || "";
  const inAmountRaw =
    chunk.inAmountRaw && chunk.inAmountRaw !== "0"
      ? chunk.inAmountRaw
      : chunkAmount?.raw ?? "0";
  const outAmountRaw =
    chunk.outAmountRaw && chunk.outAmountRaw !== "0"
      ? chunk.outAmountRaw
      : minOutAmountPerChunk?.raw ?? "0";

  const isFailed = variant === "failed";
  const isCancelled = variant === "cancelled";
  const isPending = variant === "pending";

  const badgeStyles = isFailed
    ? "bg-red-500/10 border-red-500/20"
    : isCancelled
      ? "bg-muted border-border"
      : "bg-amber-500/10 border-amber-500/20";
  const iconColor = isFailed ? "text-red-500" : isCancelled ? "text-muted-foreground" : "text-amber-500";
  const labelColor = isFailed ? "text-red-500" : isCancelled ? "text-muted-foreground" : "text-amber-500";
  const label = isFailed ? "Failed" : isCancelled ? "Chunk cancelled" : "Pending";

  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Chunk #{chunk.index}
        </span>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${badgeStyles}`}
        >
          {isFailed ? (
            <AlertCircle className="w-3 h-3 text-red-500" />
          ) : isCancelled ? (
            <XCircle className={`w-3 h-3 ${iconColor}`} />
          ) : (
            <Loader2 className={`w-3 h-3 ${iconColor} animate-spin`} />
          )}
          <span className={`text-xs ${labelColor}`}>
            {label}
          </span>
        </div>
      </div>
      {(inTokenAddress || outTokenAddress) && (
        <div className="flex items-center gap-3 flex-wrap flex-row">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
            <span className="text-xs text-muted-foreground">Sell</span>
            <TokenAmount
              amountRaw={inAmountRaw}
              address={inTokenAddress}
              chainId={chunk.chainId ?? chainId ?? 0}
              usd=""
            />
          </div>
          <ArrowRight className="w-4 h-4 text-primary" />
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
            <span className="text-xs text-muted-foreground">Buy</span>
            <TokenAmount
              amountRaw={outAmountRaw}
              address={outTokenAddress}
              chainId={chunk.chainId ?? chainId ?? 0}
              usd=""
            />
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {readableDescription}
      </p>
      {chunk.dueTime && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Due: {toMoment(chunk.dueTime).format("lll")}</span>
        </div>
      )}
    </div>
  );
};

const ChunkCard = ({
  chunk,
}: {
  chunk: ParsedOrderChunk;
}) => {
  const feesFormatted = useFormatNumber({
    value: chunk.feesUsd,
    decimalScale: 2,
  });

  const isSuccess = chunk.txHash && chunk.txHash !== "0x";

  if (!isSuccess) return null;

  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            Chunk #{chunk.index}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-xs text-green-500">Filled</span>
        </div>
      </div>

      {/* Swap Flow */}
      <div className="flex items-center gap-3 flex-wrap flex-row">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground">Sell</span>
          <TokenAmount
            amountRaw={chunk.inAmountRaw}
            address={chunk.inToken}
            chainId={chunk.chainId}
            usd=""
          />
        </div>
        <ArrowRight className="w-4 h-4 text-primary" />
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground">Buy</span>
          <TokenAmount
            amountRaw={chunk.outAmountRaw}
            address={chunk.outToken}
            chainId={chunk.chainId}
            usd=""
          />
        </div>
      </div>

      {/* Details Row */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Fee:</span>
            <span className="font-mono text-foreground">${feesFormatted}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {toMoment(chunk.dueTime).format("lll")}
            </span>
          </div>
        </div>
        {chunk.txHash && (
          <div className="flex items-center gap-1">
            <Address address={chunk.txHash} chainId={chunk.chainId || 0} />
          </div>
        )}
      </div>
    </div>
  );
};
