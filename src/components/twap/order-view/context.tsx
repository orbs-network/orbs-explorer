import { useSpotOrder } from "@/lib/hooks/twap-hooks/use-spot-order";
import { Order } from "@/lib/types";
import { createContext } from "react";

type OrderContextType = ReturnType<typeof useSpotOrder> & {
    order: Order;
  };
  
  export const OrderViewContext = createContext<OrderContextType>({} as OrderContextType);