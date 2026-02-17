import { Button } from "@/components/ui/button";
import { DialogHeader } from "@/components/ui/dialog";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Code, Minimize2, Maximize2 } from "lucide-react";
import { useState } from "react";
import { ClientReactJson } from "@/components/client-json-view";
import { useOrderViewContext } from "./use-order-view-context";

export const OriginalOrder = () => {
    const { originalOrder } = useOrderViewContext();
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
            <ClientReactJson
              src={originalOrder!}
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
  