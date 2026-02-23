import { ExplorerLink } from "@/components/explorer-link";
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
import { ParsedOrderChunk, Token, OrderChunk } from "@/lib/types";
import { toMoment } from "@/lib/utils/utils";
import {
  parseChunkDescription,
  type ParsedChunkDescription,
} from "@/lib/utils/spot-utils";
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
  Zap,
  Database,
  Code,
} from "lucide-react";
import { useSpotOrderChunks } from "@/lib/hooks/twap-hooks/use-spot-order-chunks";
import { createContext, useContext, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClientReactJson } from "@/components/client-json-view";
import { useOrderViewContext } from "./use-order-view-context";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import BN from "bignumber.js";
import { useToUiAmount } from "@/lib/hooks/use-to-ui-amount";
import { Amount } from "@/components/ui/amount";

const EMPTY = "—";

const ChunkDetailsContext = createContext<ParsedOrderChunk | null>(null);

function useChunkDetails() {
  const chunk = useContext(ChunkDetailsContext);
  if (!chunk)
    throw new Error(
      "Chunk details field must be used inside ChunkDetailsSection",
    );
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
    <div className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-0.5 min-w-0 items-baseline sm:grid-cols-[minmax(0,9rem)_1fr]">
      <dt className="text-[12px] font-medium text-muted-foreground truncate">
        {label}
      </dt>
      <dd className="font-mono text-[13px] text-foreground break-all tabular-nums">
        {value ?? EMPTY}
      </dd>
    </div>
  );
}

function DetailSectionBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-4 first:pt-0">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </span>
      </div>
      <dl className="flex flex-col gap-2.5 pl-0">
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
      value={
        chunk.createdAt != null ? toMoment(chunk.createdAt).format("lll") : null
      }
    />
  );
}
function UpdatedAt() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Updated at"
      value={
        chunk.updatedAt != null ? toMoment(chunk.updatedAt).format("lll") : null
      }
    />
  );
}
function DueTime() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Due time"
      value={
        chunk.dueTime != null ? toMoment(chunk.dueTime).format("lll") : null
      }
    />
  );
}
function Block() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Block"
      value={
        <ExplorerLink
          value={chunk.blockId?.toString()}
          chainId={chunk.chainId || 0}
        />
      }
    />
  );
}
function TxHash() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Tx Hash"
      value={<ExplorerLink value={chunk.txHash} chainId={chunk.chainId || 0} />}
    />
  );
}
function Executor() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Executor"
      value={
        <ExplorerLink value={chunk.executor} chainId={chunk.chainId || 0} />
      }
    />
  );
}
function Swapper() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label="Swapper"
      value={
        <ExplorerLink value={chunk.swapper} chainId={chunk.chainId || 0} />
      }
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
      value={
        <ExplorerLink value={chunk.exchange} chainId={chunk.chainId || 0} />
      }
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
  return (
    <DetailRow
      label="Address"
      value={
        <ExplorerLink
          value={chunk.oracleAddress}
          chainId={chunk.chainId || 0}
        />
      }
    />
  );
};

const FeeOnTransfer = () => {
  const chunk = useChunkDetails();

  const value = useFormatNumber({
    value: useToUiAmount(chunk.inToken?.decimals, chunk.feeOnTransfer),
  });

  if (chunk.feeOnTransferError) {
    return (
      <div className="text-muted-foreground flex items-start gap-2 w-full text-xs bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
        <p className="text-red-500 break-all flex-1">
          Transfer Fee Estimation Error: {chunk.feeOnTransferError}
        </p>
      </div>
    );
  }

  if (BN(chunk.feeOnTransfer).isZero()) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 w-fit text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
        <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
        <span className="text-emerald-700 dark:text-emerald-400 font-medium">No fee on transfer</span>
      </div>
    );
  }

  return <DetailRow label="Fee on Transfer" value={value} />;
};

function InputTokenPrice() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label={`In Token Price (${chunk.inToken?.symbol})`}
      value={
        chunk.inputTokenUsd != null ? (
          <Amount amount={chunk.inputTokenUsd} prefix="$" />
        ) : null
      }
    />
  );
}
function OutputTokenPrice() {
  const chunk = useChunkDetails();
  return (
    <DetailRow
      label={`Out Token Price (${chunk.outToken?.symbol})`}
      value={
        chunk.outputTokenUsd != null ? (
          <Amount amount={chunk.outputTokenUsd} prefix="$" />
        ) : null
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
        <div className="flex items-center gap-1 w-full">
          <TokenAmountFormatted
            amount="1"
            token={chunk.inToken}
            chainId={chunk.chainId || 0}
            usd=""
          />
          <span className="text-secondary-foreground font-mono font-bold">
            =
          </span>
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
    <DetailSectionBlock title="Timing" icon={Clock}>
      <CreatedAt />
      <UpdatedAt />
      <DueTime />
    </DetailSectionBlock>
  );
}
function ChunkDetailsFillSection() {
  return (
    <DetailSectionBlock title="Fill" icon={Zap}>
      <InputAmount />
      <OutputAmount />
      <MinOutputAmount />
      <Block />
      <TxHash />
      <Executor />
      <Swapper />
      <Exchange />
    </DetailSectionBlock>
  );
}

function ChunkDetailsOracleSection() {
  return (
    <DetailSectionBlock title="Oracle & pricing" icon={Database}>
      <OracleName />
      <OracleAddress />
      <OracleTimestamp />
      <InputTokenPrice />
      <OutputTokenPrice />
      <ExpectedOutput />
      <ExchangeRate />
    </DetailSectionBlock>
  );
}

function ChunkDetailsSection({ chunk }: { chunk: ParsedOrderChunk }) {
  return (
    <ChunkDetailsContext.Provider value={chunk}>
      <div className="rounded-xl border border-border/60 bg-gradient-to-b from-muted/20 to-muted/5 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-border/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Chunk details
          </span>
        </div>
        <div className="space-y-0 divide-y divide-border/40">
          <ChunkDetailsFillSection />
          <ChunkDetailsTimingSection />
          <ChunkDetailsOracleSection />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <FeeOnTransfer />
        </div>
      </div>
    </ChunkDetailsContext.Provider>
  );
}

function RawChunkModal({
  chunkIndex,
  rawChunk,
  trigger,
}: {
  chunkIndex: number;
  rawChunk: OrderChunk;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Chunk #{chunkIndex} — Raw Object
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-lg bg-[#1e1e1e] p-4 min-h-[200px]">
          <ClientReactJson
            src={rawChunk as unknown as object}
            theme="monokai"
            collapsed={1}
            displayDataTypes={false}
            enableClipboard
            style={{ backgroundColor: "transparent" }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrderChunks() {
  const { hash, order } = useOrderViewContext();
  const searchParams = useSearchParams();
  const isDev = searchParams.get("dev") === "true";
  const { chunks, order: spotOrder } = useSpotOrderChunks(hash);
  const rawChunks = order?.metadata?.chunks ?? [];
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
              <span className="capitalize">
              {failedChunks.length > 0
                ? `${spotOrder?.type} Order Fills (cancelled)`
                : `${spotOrder?.type} Order Fills`}
              </span>
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
            {successChunks.map((chunk) => (
              <ChunkCard
                key={`success-${chunk.index}`}
                chunk={chunk}
                isDev={isDev}
                rawChunk={rawChunks.find((c) => c.index === chunk.index)}
              />
            ))}
            {pendingChunks.map((chunk) => (
              <ChunkCardPendingOrFailed
                key={`pending-${chunk.index}`}
                chunk={chunk}
                variant="pending"
                isDev={isDev}
                rawChunk={rawChunks.find((c) => c.index === chunk.index)}
              />
            ))}
            {failedChunks.map((chunk) => (
              <ChunkCardPendingOrFailed
                key={`failed-${chunk.index}`}
                chunk={chunk}
                variant="failed"
                isDev={isDev}
                rawChunk={rawChunks.find((c) => c.index === chunk.index)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </TransactionDisplay.SectionItem>
  );
}

function TextWithAmounts({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:\.\d+)?)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\d+(?:\.\d+)?$/.test(part) ? (
          <Amount key={i} amount={part} className="font-semibold" />
        ) : (
          part
        ),
      )}
    </>
  );
}

function ChunkDescriptionDisplay({
  parsed,
}: {
  parsed: ParsedChunkDescription;
}) {
  const sym = (p: { symbol?: string }) =>
    p.symbol ? (
      <span className="font-semibold text-foreground"> {p.symbol}</span>
    ) : null;

  if (parsed.type === "trigger") {
    return (
      <>
        Trigger price not met, current output{" "}
        <Amount amount={parsed.current} className="font-semibold" decimalAmount />
        {sym(parsed)} &gt; trigger{" "}
        <Amount amount={parsed.trigger} className="font-semibold" decimalAmount />
        {sym(parsed)} — <Amount amount={parsed.pct} className="font-semibold" />
        %
      </>
    );
  }

  if (parsed.type === "limit_price") {
    return (
      <>
        Limit price not met: current price{" "}
        <Amount amount={parsed.got} className="font-semibold" decimalAmount />
        {sym(parsed)} is below your limit{" "}
        <Amount amount={parsed.expected} className="font-semibold" decimalAmount />
        {sym(parsed)} — <Amount amount={parsed.pct} className="font-semibold" />
        % of target. This chunk will fill when the market reaches your limit
        price.
      </>
    );
  }

  return <TextWithAmounts text={parsed.text} />;
}

const ChunkCardPendingOrFailed = ({
  chunk,
  variant,
  isDev,
  rawChunk,
}: {
  chunk: ParsedOrderChunk;
  variant: "pending" | "failed" | "cancelled";
  isDev?: boolean;
  rawChunk?: OrderChunk;
}) => {
  const { dstToken, chainId, chunkAmount, minOutAmountPerChunk } =
    useOrderViewContext();
  const parsedDescription = parseChunkDescription(
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

  const hoverBorder = isFailed
    ? "hover:border-red-500/30"
    : isCancelled
      ? "hover:border-border"
      : "hover:border-amber-500/30";

  return (
    <details className={`group rounded-xl border border-border/60 bg-card/50 shadow-sm ${hoverBorder} hover:shadow-md transition-all duration-200 overflow-hidden`}>
      <summary className="flex flex-col gap-3 px-4 py-3.5 cursor-pointer list-none select-none hover:bg-muted/20 transition-colors">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              Chunk #{chunk.index}
            </span>
            {isDev && rawChunk && (
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <RawChunkModal
                  chunkIndex={chunk.index}
                  rawChunk={rawChunk}
                  trigger={
                    <button
                      type="button"
                      className="p-1.5 rounded border border-border/60 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View raw chunk"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              </div>
            )}
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
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180" />
        </div>
        <div className="min-w-0 w-full">
          <ChunkSummaryLine
            inAmount={inAmountRaw}
            inToken={chunk.inToken}
            outAmount={outAmountRaw}
            outToken={chunk.outToken}
            chainId={chunk.chainId ?? chainId ?? 0}
          />
        </div>
      </summary>
      <div className="px-4 pb-4 pt-3 border-t border-border/50 bg-muted/5">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <ChunkDescriptionDisplay parsed={parsedDescription} />
        </div>
        {chunk.dueTime && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
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
    <div className="flex items-center gap-2 flex-wrap w-full">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 shadow-sm min-w-0 flex-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest shrink-0">
          In
        </span>
        <TokenAmount
          amountRaw={inAmount}
          address={inToken?.address}
          chainId={chainId ?? 0}
          usd=""
          className="pointer-events-none font-medium"
        />
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground/70 shrink-0" />
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 shadow-sm min-w-0 flex-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest shrink-0">
          Out
        </span>
        <TokenAmount
          amountRaw={outAmount}
          address={outToken?.address}
          chainId={chainId ?? 0}
          usd=""
          className="pointer-events-none font-medium"
        />
      </div>
    </div>
  );
}

const ChunkCard = ({
  chunk,
  isDev,
  rawChunk,
}: {
  chunk: ParsedOrderChunk;
  isDev?: boolean;
  rawChunk?: OrderChunk;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="group rounded-xl border border-border/60 bg-card/50 shadow-sm hover:border-emerald-500/30 hover:shadow-md transition-all duration-200 overflow-hidden"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex flex-col gap-3 px-4 py-3.5 cursor-pointer list-none select-none hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-3 justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              Chunk #{chunk.index}
            </span>
            {isDev && rawChunk && (
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <RawChunkModal
                  chunkIndex={chunk.index}
                  rawChunk={rawChunk}
                  trigger={
                    <button
                      type="button"
                      className="p-1.5 rounded border border-border/60 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="View raw chunk"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-400">Filled</span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 group-open:rotate-180" />
        </div>
        <div className="min-w-0 w-full">
          <ChunkSummaryLine
            inAmount={chunk.inAmount ?? "0"}
            inToken={chunk.inToken}
            outAmount={chunk.outAmount ?? "0"}
            outToken={chunk.outToken}
            chainId={chunk.chainId ?? 0}
          />
        </div>
      </summary>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50 bg-muted/5">
          <ChunkDetailsSection chunk={chunk} />
        </div>
      )}
    </details>
  );
};
