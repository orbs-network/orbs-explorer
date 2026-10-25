"use client";

import { ActivitySummary, ActivityTime } from "@/components/activity-summary";
import { getSwapStory } from "@orbs/domain/activity/swap-story";
import { Copy } from "@orbs/ui/controls/copy";
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
} from "@orbs/domain/liquidity-hub";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@orbs/ui/controls/dialog";
import { Button } from "@orbs/ui/controls/button";

import { Token } from "@orbs/domain/types";

import { useHeight } from "@orbs/domain/hooks/use-height";
import { Switch } from "@orbs/ui/controls/switch";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@orbs/ui/controls/tabs";
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

import { useTokens, useToken } from "@orbs/domain/hooks/use-token";
import { Network } from "@orbs/ui/controls/network";
import { Partner } from "@orbs/ui/controls/partner";
import moment from "moment";
import { usePriceUsd } from "@orbs/domain/hooks/use-price-usd";
import { useOutTokenUsd } from "@orbs/domain/liquidity-hub/hooks";
import { useFormatNumber } from "@orbs/domain/hooks/use-number-format";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import { eqIgnoreCase } from "@orbs/domain/utils/utils";
import { ExplorerLink } from "../explorer-link";

interface ContextType extends SwapQueryResponse {
  isPreview?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  fetchedAt?: number;
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
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useLHSwap(identifier);

  if (isLoading) {
    return <TransactionDisplay.Loading message="Loading transaction..." />;
  }

  if (isError) {
    return (
      <ActivitySummary
        title="Swap data is unavailable"
        tone="warning"
        explanation="Swap details could not be loaded. This does not mean your swap failed."
        nextStep="Refresh this page, or use the transaction ID from your trading app to check the blockchain record."
        onRefresh={() => refetch()}
        refreshing={isFetching}
      />
    );
  }
  if (!data) {
    return (
      <TransactionDisplay.NotFound
        title="Swap not found"
        description="No swap was found for this ID. Check the transaction ID or swap attempt ID in the app where you made the swap."
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
        warnings: swapData.warnings,
        onRefresh: () => refetch(),
        refreshing: isFetching,
        fetchedAt: dataUpdatedAt,
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
      label="Alternative swap estimate"
      tooltip="An estimate for the trading app’s own route, after gas costs."
    >
      <TokenAmount
        amountRaw={swap.dexSimulateOutMinusGas?.toString()}
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

  if (!quote)
    return (
      <TransactionDisplay.SectionItem label="Estimated output">
        Quote data not available
      </TransactionDisplay.SectionItem>
    );

  return (
    <TransactionDisplay.SectionItem
      description="(estimate)"
      label="Estimated received amount"
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

  if (swap.swapStatus?.toLowerCase() !== "success")
    return (
      <TransactionDisplay.SectionItem label="Received amount">
        No successful output reported
      </TransactionDisplay.SectionItem>
    );
  if (swap.exactOutAmount === undefined)
    return (
      <TransactionDisplay.SectionItem label="Received amount">
        Amount not reported
      </TransactionDisplay.SectionItem>
    );
  return (
    <TransactionDisplay.SectionItem
      description="(reported by the swap service)"
      label="Received amount"
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
    <TransactionDisplay.SectionItem label="Reported fee">
      <TokenAmount
        amountRaw={swap.feeOutAmount?.toString()}
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

  if (!quote)
    return (
      <TransactionDisplay.SectionItem label="Savings">
        Quote data not available
      </TransactionDisplay.SectionItem>
    );

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

  if (!quote)
    return (
      <TransactionDisplay.SectionItem label="Output before deductions">
        Quote data not available
      </TransactionDisplay.SectionItem>
    );

  return (
    <TransactionDisplay.SectionItem
      description="(service reported, pre deductions)"
      label="Reported output before fees and gas"
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
            <h1 className="text-xl font-semibold">Liquidity Hub swap</h1>
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

const SwapExplanation = () => {
  const { swap, quotes, warnings, onRefresh, refreshing, fetchedAt } =
    useSwapPageContext();
  const story = getSwapStory(swap);
  return (
    <>
      <ActivitySummary
        {...story}
        onRefresh={onRefresh}
        refreshing={refreshing}
        facts={[
          {
            label: "Latest step",
            value: swap.stage || "Not reported",
          },
          {
            label: "Blockchain status (reported)",
            value: swap.txStatus || "Not reported",
          },
          {
            label: "Network block",
            value: swap.blockNumber
              ? swap.blockNumber.toLocaleString()
              : "Not reported",
          },
          {
            label: "Price estimates available",
            value: warnings?.some((warning) => warning.startsWith("Quote"))
              ? "Unavailable"
              : quotes.length.toLocaleString(),
          },
          {
            label: "Recorded at",
            value: <ActivityTime value={swap.timestamp} />,
          },
          {
            label: "Last updated",
            value: <ActivityTime value={fetchedAt} />,
          },
        ]}
        actions={
          swap.txHash ? (
            <ExplorerLink value={swap.txHash} chainId={swap.chainId}>
              Check on the blockchain
            </ExplorerLink>
          ) : undefined
        }
      />
      {warnings?.map((warning) => (
        <p
          key={warning}
          role="status"
          className="text-sm text-muted-foreground"
        >
          {warning}
        </p>
      ))}
    </>
  );
};

const Content = () => {
  const [showTransfers, setShowTransfers] = useState(false);
  const { swap } = useSwapPageContext();
  return (
    <div className="flex flex-col gap-4">
      <SwapHeader />
      <SwapExplanation />

      <TransactionDisplay.Grid>
        {/* Transaction Details Card */}
        <TransactionDisplay.SectionCard
          title="Transaction Details"
          icon={Receipt}
        >
          <TransactionDisplay.SectionItem label="Blockchain transaction">
            <div className="flex items-center gap-2">
              <ExplorerLink value={swap.txHash} chainId={swap.chainId} />
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Swap attempt ID">
            <Copy text={swap.sessionId} value={swap.sessionId} />
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Network">
            <Network chainId={swap.chainId} />
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Trading app">
            <Partner id={swap.dex} />
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Your wallet">
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <ExplorerLink value={swap.user} chainId={swap.chainId} />
            </div>
          </TransactionDisplay.SectionItem>
          <TransactionDisplay.SectionItem label="Price protection (slippage)">
            <span className="px-2 py-0.5 bg-muted rounded text-sm font-mono">
              {swap.slippage?.toString() ?? "Not reported"}%
            </span>
          </TransactionDisplay.SectionItem>
        </TransactionDisplay.SectionCard>

        {/* Swap Amounts Card */}
        <TransactionDisplay.SectionCard title="Amounts" icon={PiggyBank}>
          <TransactionDisplay.SectionItem label="Amount to swap">
            <TokenAmount
              amountRaw={swap.amountIn?.toString()}
              address={swap.tokenInAddress}
              chainId={swap.chainId}
              usd={swap.amountInUSD?.toString() || "0"}
            />
          </TransactionDisplay.SectionItem>
          <AmountOutLHPostDeductions />
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer text-sm font-medium">
              Price comparison and estimates
            </summary>
            <div className="mt-3 space-y-3">
              <DexAmountOut />
              <AmountOutLHEstimate />
              <AmountOutLHActual />
            </div>
          </details>
        </TransactionDisplay.SectionCard>
      </TransactionDisplay.Grid>

      {swap.txHash && (
        <details
          className="rounded-lg border border-border bg-card p-4"
          onToggle={(event) => setShowTransfers(event.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium">
            Check token transfers on the blockchain
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Receipt transfers show token movements reported by the network,
            separately from quote estimates.
          </p>
          {showTransfers && (
            <div className="mt-3">
              <Transfers />
            </div>
          )}
        </details>
      )}
      {/* Fees & Savings Card */}
      <TransactionDisplay.SectionCard
        title="Fees & Savings"
        icon={CheckCircle2}
      >
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
          <p className="text-sm text-muted-foreground font-mono">
            {swap.sessionId}
          </p>
        </DialogHeader>
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Data
            </label>
            <div className="p-4 bg-muted/50 rounded-lg border border-border overflow-x-auto">
              <p className="text-sm font-mono break-all text-muted-foreground">
                {swap.dexRouteData}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-foreground uppercase tracking-wide">
              To Address
            </label>
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
  const transfersQuery = useTransfers(swap);
  const transfers = transfersQuery.data;
  const addresses = useMemo(() => {
    if (!transfers) return [];
    return transfers
      .filter((transfer) => transfer.value)
      .map((it) => it.tokenAddress);
  }, [transfers]);

  const tokens = useTokens(addresses, swap.chainId).data;
  if (transfersQuery.isLoading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading network receipt…
      </p>
    );
  if (transfersQuery.isError)
    return (
      <div role="status" className="text-sm text-muted-foreground">
        Network receipt unavailable. This does not establish the transaction
        outcome.{" "}
        <button
          className="text-primary underline"
          onClick={() => transfersQuery.refetch()}
        >
          Retry receipt
        </button>
      </div>
    );
  if (!transfers?.length)
    return (
      <p className="text-sm text-muted-foreground">
        No ERC-20 transfers found in this receipt. Native currency transfers are
        not included.
      </p>
    );

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
            {transfers.length} transfer{transfers.length !== 1 ? "s" : ""} in
            this transaction
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 max-h-[500px]">
          {transfers?.map((transfer, index) => {
            return (
              <Transfer
                key={index}
                log={transfer}
                tokens={tokens ?? []}
                index={index}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Transfer = ({
  log,
  tokens,
  index,
}: {
  log: TransferLog;
  tokens: Token[];
  index: number;
}) => {
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
              <p className="text-sm text-muted-foreground font-mono mt-1">
                {swap.sessionId}
              </p>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Theme</span>
              <Switch
                checked={darkMode}
                onCheckedChange={(checked) => setDarkMode(checked)}
              />
              <span className="text-xs text-muted-foreground">
                {darkMode ? "Dark" : "Light"}
              </span>
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
          <p className="text-sm text-muted-foreground font-mono">
            {swap.sessionId}
          </p>
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
              <p className="text-muted-foreground text-sm">
                Client logs not available
              </p>
            </div>
          </TabsContent>
          <TabsContent value="swap" className="mt-0">
            <div className="p-4 bg-muted/30 rounded-lg border border-border min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Swap logs not available
              </p>
            </div>
          </TabsContent>
          <TabsContent value="quote" className="mt-0">
            <div className="p-4 bg-muted/30 rounded-lg border border-border min-h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Quote logs not available
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
