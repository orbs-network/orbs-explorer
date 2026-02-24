import { useSpotOrder } from "@/lib/twap";
import type { Order } from "@/lib/twap";
import { createContext } from "react";

type OrderContextType = ReturnType<typeof useSpotOrder> & {
    order: Order;
  };
  
  export const OrderViewContext = createContext<OrderContextType>({} as OrderContextType);