import { Order, OrderFill as Fill } from "@orbs-network/spot-ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Clock, ExternalLink, FileText, Layers, ListCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReactNode } from "react";
import moment from "moment";
import { Address } from "../token-address";
import { useFormatNumber } from "@/lib/hooks/use-number-format";
import { toAmountUI } from "@/lib/utils/utils";
import { useToken } from "@/lib/hooks/use-token";

export const OrderFills = ({ order }: { order: Order }) => {
  const fillCount = order?.fills?.length || 0;
  const totalCount = order?.totalTradesAmount || 0;
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Layers className="w-4 h-4" />
          <span>Fills</span>
          <span className="font-mono text-xs px-1.5 py-0.5 bg-muted rounded">
            {fillCount}/{totalCount}
          </span>
          {fillCount === totalCount && totalCount > 0 && (
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Order #{order?.id} Fills
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {fillCount} of {totalCount} trades completed
          </p>
        </DialogHeader>
        {!order.fills?.length ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No fills yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {order?.fills?.map((fill, index) => (
              <FillCard key={fill.txHash} fill={fill} order={order} index={index} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const FillCard = ({ fill, order, index }: { fill: Fill; order: Order; index: number }) => {
  return (
    <Card className="p-4 flex flex-col gap-3 border border-border rounded-lg hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-foreground">Fill #{index + 1}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-xs text-green-500">Completed</span>
        </div>
      </div>

      {/* Amounts */}
      <div className="flex items-center gap-3 flex-wrap">
        <FillAmountBadge
          address={order.srcTokenAddress}
          amount={fill.outAmount}
          chainId={order.chainId}
          label="Sold"
        />
        <ArrowRight className="w-4 h-4 text-primary" />
        <FillAmountBadge
          address={order.dstTokenAddress}
          amount={fill.outAmount}
          chainId={order.chainId}
          label="Bought"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className="text-xs">{moment(fill.timestamp).format("lll")}</span>
          <span className="text-xs text-muted-foreground/60">({moment(fill.timestamp).fromNow()})</span>
        </div>
        <div className="flex items-center gap-1">
          <Address address={fill.txHash} chainId={order.chainId} />
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
};

const FillAmountBadge = ({
  address,
  amount,
  chainId,
  label,
}: {
  address: string;
  amount: string;
  chainId: number;
  label: string;
}) => {
  const token = useToken(address, chainId).data;
  const amountF = useFormatNumber({
    value: toAmountUI(amount, token?.decimals),
  });

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
      <span className="text-sm font-mono font-medium text-foreground">
        {amountF} <span className="text-primary">{token?.symbol}</span>
      </span>
    </div>
  );
};
