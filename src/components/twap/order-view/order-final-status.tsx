import { formatChunkDescription } from "@/lib/utils/spot-utils";
import { useOrderViewContext } from "./use-order-view-context";
import { AlertTriangle, CheckCircle } from "lucide-react";

const OrderFailureReason = () => {
    const { description, dstToken } = useOrderViewContext();
  
    const readableDescription = formatChunkDescription(description, dstToken?.symbol);
  
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-red-500/10">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-red-500">Order Failed</h3>
            {description && (
              <p className="text-xs text-muted-foreground">
                {readableDescription}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

   const OrderSuccessReason = () => {
    const { description, dstToken } = useOrderViewContext();

    const readableDescription = formatChunkDescription(description, dstToken?.symbol);

    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-green-500/10">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-green-500">Order Filled</h3>
        </div>
      </div>
    );
  };


  export const OrderFinalStatus = () => {
    const { status } = useOrderViewContext();

    const isFailed =
      status === "failed" || status === "expired" || status === "canceled";

    if (isFailed) return <OrderFailureReason />;
    if (status === "completed") return <OrderSuccessReason />;
    return null;
  };