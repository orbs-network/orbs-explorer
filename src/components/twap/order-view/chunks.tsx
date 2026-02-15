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
} from "lucide-react";

import React from "react";
import { getOrderChunks } from "@/lib/hooks/twap-hooks/use-spot-order";

export function OrderChunks({ expectedChunks, successChunks, failedChunks, pendingChunks }: { expectedChunks: number, successChunks: ParsedOrderChunk[], failedChunks: ParsedOrderChunk[], pendingChunks: ParsedOrderChunk[] }) {
  if (!expectedChunks) return null;

  return (
    <TransactionDisplay.SectionItem label="Fills">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Layers className="w-4 h-4" />
            <span className="font-mono">
              {successChunks.length} / {expectedChunks}
            </span>
            {successChunks.length === expectedChunks && expectedChunks > 0 && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Order Fills
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {successChunks.length} of {expectedChunks} chunks filled
              {failedChunks.length > 0 && (
                <span className="text-red-500 ml-2">
                  ({failedChunks.length} failed)
                </span>
              )}
              {pendingChunks.length > 0 && (
                <span className="text-amber-500 ml-2">
                  ({pendingChunks.length} pending)
                </span>
              )}
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {successChunks.map((chunk, index) => (
              <ChunkCard key={`success-${chunk.index}`} chunk={chunk} index={index} />
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
  variant: "pending" | "failed";
}) => {
  const readableDescription = formatChunkDescription(chunk.description);

  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Chunk #{chunk.index}
        </span>
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${
            variant === "failed"
              ? "bg-red-500/10 border-red-500/20"
              : "bg-amber-500/10 border-amber-500/20"
          }`}
        >
          {variant === "failed" ? (
            <AlertCircle className="w-3 h-3 text-red-500" />
          ) : (
            <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
          )}
          <span
            className={`text-xs ${
              variant === "failed" ? "text-red-500" : "text-amber-500"
            }`}
          >
            {variant === "failed" ? "Failed" : "Pending"}
          </span>
        </div>
      </div>
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
  index,
}: {
  chunk: ParsedOrderChunk;
  index: number;
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
      <div className="flex items-center gap-3 flex-wrap flex-col">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md w-full">
          <span className="text-xs text-muted-foreground uppercase">Sell</span>
          <TokenAmount
            amountRaw={chunk.inAmountRaw}
            address={chunk.inToken}
            chainId={chunk.chainId}
            usd=""
          />
        </div>
        <ArrowDown className="w-4 h-4 text-primary" />
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md w-full">
          <span className="text-xs text-muted-foreground uppercase">Buy</span>
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
