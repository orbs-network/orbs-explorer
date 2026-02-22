"use client";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-sh";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/theme-github";

import {
  getAmountReceivedPostDeductions,
  getExpectedLhAmountOut,
  getLhExactOutAmountPreDeduction,
  getUserSavings,
  SwapQueryResponse,
  TransferLog,
  useLHLogTrace,
  useLHSwap,
  useTransfers,
} from "@/lib/liquidity-hub";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Token } from "@/lib/types";

import { useHeight } from "@/lib/hooks/use-height";
import { Switch } from "@/components/ui/switch";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import { TransactionDisplay } from "@/components/transaction-display";
import { TokenDisplay } from "@/components/token-display";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { TokenAmount } from "@/components/token-amount";

import { useTokens, useToken } from "@/lib/hooks/use-token";
import { Network } from "../ui/network";
import { Partner } from "../ui/partner";
import moment from "moment";
import { usePriceUsd } from "@/lib/hooks/use-price-usd";
import { useOutTokenUsd } from "@/lib/liquidity-hub/hooks";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import { eqIgnoreCase } from "@/lib/utils/utils";
import { ExplorerLink } from "../explorer-link";

interface ContextType extends SwapQueryResponse {
  isPreview?: boolean;
}

const Context = createContext({} as ContextType);

const useSwapPageContext = () => {
  const context = useContext(Context);
  if (!context) {
    throw new Error(
      "useSwapPageContext must be used within a SwapPageContextProvider",
    );
  }
  return context;
};

export function LiquidityHubTxView({
  isPreview,
  identifier,
  defaultBackHref,
}: {
  isPreview?: boolean;
  identifier: string;
  /** When no history to go back, navigate here */
  defaultBackHref?: string;
}) {
  const content = (
    <TransactionDisplay.Container>
      {!isPreview && (
        <TransactionDisplay.ContainerHeader defaultBackHref={defaultBackHref} />
      )}
      <State isPreview={isPreview} identifier={identifier} />
    </TransactionDisplay.Container>
  );
  if (isPreview) {
    return content;
  }

  return content;
}

const State = ({
  isPreview,
  identifier,
}: {
  isPreview?: boolean;
  identifier: string;
}) => {
  const { data, isLoading } = useLHSwap(identifier);

  if (isLoading) {
    return <TransactionDisplay.Loading message="Loading transaction..." />;
  }

  if (!data) {
    return (
      <TransactionDisplay.NotFound
        title="Session Not Found"
        description="The transaction you're looking for doesn't exist or has expired."
      />
    );
  }

  const swapData = data as unknown as SwapQueryResponse;
  return (
    <Context.Provider
      value={{
        swap: swapData.swap,
        quotes: swapData.quotes,
        clientLogs: swapData.clientLogs,
        quote: swapData.quote,
        isPreview,
      }}
    >
      <Content />
    </Context.Provider>
  );
};

const DexAmountOut = () => {
  const { swap } = useSwapPageContext();

  const usd = useFormatNumber({
    value: useOutTokenUsd(swap, swap.dexSimulateOutMinusGas),
    decimalScale: 2,
  });

  return (
    <TransactionDisplay.SectionItem
      description="(minus gas)"
      label="Dex Amount Out "
      tooltip="The amount user would received via dex"
    >
      <TokenAmount
        amountRaw={swap.dexSimulateOutMinusGas.toString()}
        address={swap.tokenOutAddress}
        chainId={swap.chainId}
        usd={usd}
      />
    </TransactionDisplay.SectionItem>
  );
};

const AmountOutLHEstimate = () => {
  const { swap, quote } = useSwapPageContext();
  const value = getExpectedLhAmountOut(swap, quote);

  const usd = useFormatNumber({
    value: useOutTokenUsd(swap, value),
    decimalScale: 2,
  });

  return (
    <TransactionDisplay.SectionItem
      description="(estimate)"
      label="Amount Out LH"
    >
      <TokenAmount
        amountRaw={value.toString()}
        address={swap.tokenOutAddress}
        chainId={swap.chainId}
        usd={usd}
      />
    </TransactionDisplay.SectionItem>
  );
};

const AmountOutLHPostDeductions = () => {
  const { swap, quote } = useSwapPageContext();
  const value = getAmountReceivedPostDeductions(swap);

  const usd = useFormatNumber({
    value: useOutTokenUsd(swap, value),
    decimalScale: 2,
  });

  return (
    <TransactionDisplay.SectionItem
      description="(actual post deductions)"
      label="Amount Out LH"
    >
      <TokenAmount
        amountRaw={value.toString()}
        address={swap.tokenOutAddress}
        chainId={swap.chainId}
        usd={usd}
      />
    </TransactionDisplay.SectionItem>
  );
};

const Fees = () => {
  const { swap } = useSwapPageContext();

  const usd = useFormatNumber({
    value: useOutTokenUsd(swap, swap.feeOutAmount),
    decimalScale: 2,
  });

  return (
    <TransactionDisplay.SectionItem label="Fees">
      <TokenAmount
        amountRaw={swap.feeOutAmount.toString()}
        address={swap.tokenOutAddress}
        chainId={swap.chainId}
        usd={usd}
      />
    </TransactionDisplay.SectionItem>
  );
};

const Savings = () => {
  const { swap, quote } = useSwapPageContext();

  const value = getUserSavings(swap, quote);

  const usd = useFormatNumber({
    value: useOutTokenUsd(swap, value),
    decimalScale: 2,
  });

  return (
    <TransactionDisplay.SectionItem label="Savings">
      <TokenAmount
        amountRaw={value}
        address={swap.tokenOutAddress}
        chainId={swap.chainId}
        usd={usd}
      />
    </TransactionDisplay.SectionItem>
  );
};

const AmountOutLHActual = () => {
  const { swap, quote } = useSwapPageContext();
  const value = getLhExactOutAmountPreDeduction(swap, quote);

  const usd = useFormatNumber({
    value: useOutTokenUsd(swap, value),
    decimalScale: 2,
  });

  return (
    <TransactionDisplay.SectionItem
      description="(actual pre deductions)"
      label="Amount Out LH"
    >
      <TokenAmount
        amountRaw={value.toString()}
        address={swap.tokenOutAddress}
        chainId={swap.chainId}
        usd={usd}
      />
    </TransactionDisplay.SectionItem>
  );
};

const SwapHeader = () => {
  const { swap } = useSwapPageContext();
  const tokenIn = useToken(swap.tokenInAddress, swap.chainId).data;
  const tokenOut = useToken(swap.tokenOutAddress, swap.chainId).data;

  return (
    <TransactionDisplay.Hero>
      <div className="flex flex-col gap-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {/* <TransactionDisplay.StatusBadge status="completed" /> */}
            <TransactionDisplay.Badge>Liquidity Hub</TransactionDisplay.Badge>
          </div>
          <TransactionDisplay.Timestamp date={swap.timestamp} />
        </div>

        {/* Swap Visual */}
        <TransactionDisplay.SwapDirection
          fromAddress={swap.tokenInAddress}
          toAddress={swap.tokenOutAddress}
          chainId={swap.chainId}

        />
      </div>
    </TransactionDisplay.Hero>
  );
};

const Content = () => {
  const { swap } = useSwapPageContext();
  return (
    <div className="flex flex-col gap-4">
      <SwapHeader />

      <TransactionDisplay.Grid>
        {/* Transaction Details Card */}
        <TransactionDisplay.SectionCard title="Transaction Details" icon={Receipt}>
          <TransactionDisplay.SectionItem label="Tx Hash">
            <div className="flex items-center gap-2">
              <ExplorerLink value={swap.txHash} chainId={swap.chainId} />
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Session ID">
            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
              {swap.sessionId}
            </span>
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Network">
            <Network chainId={swap.chainId} />
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Partner">
            <Partner id={swap.dex} />
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Swapper">
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <ExplorerLink value={swap.user} chainId={swap.chainId} />
            </div>
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Slippage">
            <span className="px-2 py-0.5 bg-muted rounded text-sm font-mono">
              {swap.slippage.toString()}%
            </span>
          </TransactionDisplay.SectionItem>
        </TransactionDisplay.SectionCard>

        {/* Swap Amounts Card */}
        <TransactionDisplay.SectionCard title="Swap Amounts" icon={PiggyBank}>
          <TransactionDisplay.SectionItem label="Amount In">
            <TokenAmount
              amountRaw={swap.amountIn.toString()}
              address={swap.tokenInAddress}
              chainId={swap.chainId}
              usd={swap.amountInUSD?.toString() || "0"}
            />
          </TransactionDisplay.SectionItem>
          <DexAmountOut />
          <AmountOutLHEstimate />
          <AmountOutLHActual />
          <AmountOutLHPostDeductions />
        </TransactionDisplay.SectionCard>
      </TransactionDisplay.Grid>

      {/* Fees & Savings Card */}
      <TransactionDisplay.SectionCard title="Fees & Savings" icon={CheckCircle2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TransactionDisplay.InfoBox>
            <Fees />
          </TransactionDisplay.InfoBox>
          <TransactionDisplay.InfoBox variant="success">
            <Savings />
          </TransactionDisplay.InfoBox>
        </div>
      </TransactionDisplay.SectionCard>
    </div>
  );
};

const DexRouterData = () => {
  const { swap } = useSwapPageContext();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          Dex Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] h-full overflow-y-auto w-full sm:max-w-[98vw] sm:max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            DEX Router Data
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">{swap.sessionId}</p>
        </DialogHeader>
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground uppercase tracking-wide">Data</label>
            <div className="p-4 bg-muted/50 rounded-lg border border-border overflow-x-auto">
              <p className="text-sm font-mono break-all text-muted-foreground">
                {swap.dexRouteData}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground uppercase tracking-wide">To Address</label>
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <ExplorerLink value={swap.dexRouteTo} chainId={swap.chainId}>
                {swap.dexRouteTo}
              </ExplorerLink>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Transfers = () => {
  const { swap } = useSwapPageContext();
  const transfers = useTransfers(swap).data;
  const addresses = useMemo(() => {
    if (!transfers) return [];
    return transfers
      .filter((transfer) => transfer.value)
      .map((it) => [it.tokenAddress, it.from, it.to])
      .flat();
  }, [transfers]);

  const tokens = useTokens(addresses, swap.chainId).data;
  if (!transfers || !swap) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowRight className="w-4 h-4" />
          <span className="hidden md:block">Transfers</span>
          <span className="md:hidden">Txns</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-primary" />
            Token Transfers
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {transfers.length} transfer{transfers.length !== 1 ? "s" : ""} in this transaction
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 max-h-[500px]">
          {transfers?.map((transfer, index) => {
            return (
              <Transfer key={index} log={transfer} tokens={tokens ?? []} index={index} />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Transfer = ({ log, tokens, index }: { log: TransferLog; tokens: Token[]; index: number }) => {
  const { swap } = useSwapPageContext();
  const { fromToken, toToken } = useMemo(() => {
    return {
      valueToken: tokens.find((it) => it.address === log.tokenAddress),
      fromToken: tokens.find((it) => it.address === log.from),
      toToken: tokens.find((it) => it.address === log.to),
    };
  }, [log.tokenAddress, log.from, log.to, tokens]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-lg border border-border hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-foreground">Transfer</span>
      </div>
      <div className="flex flex-row gap-3 items-center flex-wrap text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground uppercase">From</span>
          {fromToken ? (
            <TokenDisplay chainId={swap.chainId} address={log.from} />
          ) : (
            <ExplorerLink chainId={swap.chainId} value={log.from}>
              {eqIgnoreCase(log.from, swap.user) ? "User wallet" : undefined}
            </ExplorerLink>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-primary" />
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground uppercase">To</span>
          {toToken ? (
            <TokenDisplay chainId={swap.chainId} address={log.to} />
          ) : (
            <ExplorerLink chainId={swap.chainId} value={log.to}>
              {eqIgnoreCase(log.to, swap.user) ? "User wallet" : undefined}
            </ExplorerLink>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground uppercase">Amount</span>
        <TokenAmount
          amountRaw={log.value}
          address={log.tokenAddress}
          chainId={swap.chainId}
        />
      </div>
    </div>
  );
};

const LogTrace = () => {
  const { swap } = useSwapPageContext();
  const { data, isLoading, error } = useLHLogTrace(swap);
  const height = useHeight();
  const [darkMode, setDarkMode] = useState(true);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          <span className="hidden md:block">Log Trace</span>
          <span className="md:hidden">Logs</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] h-full overflow-y-auto w-full sm:max-w-[98vw] sm:max-h-[95vh]">
        <DialogHeader>
          <div className="flex flex-row items-center justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Log Trace
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-mono mt-1">{swap.sessionId}</p>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Theme</span>
              <Switch
                checked={darkMode}
                onCheckedChange={(checked) => setDarkMode(checked)}
              />
              <span className="text-xs text-muted-foreground">{darkMode ? "Dark" : "Light"}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg overflow-hidden border border-border">
          <AceEditor
            theme={darkMode ? "monokai" : "github"}
            mode="sh"
            value={isLoading ? "Loading..." : error ? `Error: ${error}` : data}
            readOnly={true}
            width="100%"
            height={`${height - 150}px`}
            fontSize={14}
            showPrintMargin={false}
            showGutter={true}
            highlightActiveLine={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Logs = () => {
  const { swap, clientLogs, quotes } = useSwapPageContext();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="w-4 h-4" />
          Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] h-full overflow-y-auto w-full sm:max-w-[98vw] sm:max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Transaction Logs
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">{swap.sessionId}</p>
        </DialogHeader>
        <Tabs defaultValue="swap" className="overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background pb-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="swap" className="gap-2">
                <Receipt className="w-4 h-4" />
                Swap
              </TabsTrigger>
              <TabsTrigger value="client" className="gap-2">
                <FileText className="w-4 h-4" />
                Client
              </TabsTrigger>
              <TabsTrigger value="quote" className="gap-2">
                <PiggyBank className="w-4 h-4" />
                Quotes
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="client" className="mt-0">
            <div className="p-4 bg-muted/30 rounded-lg border border-border min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Client logs not available</p>
            </div>
          </TabsContent>
          <TabsContent value="swap" className="mt-0">
            <div className="p-4 bg-muted/30 rounded-lg border border-border min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Swap logs not available</p>
            </div>
          </TabsContent>
          <TabsContent value="quote" className="mt-0">
            <div className="p-4 bg-muted/30 rounded-lg border border-border min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Quote logs not available</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
