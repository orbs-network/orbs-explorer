import { useSpotOrder } from "@orbs/domain/twap";
import type { Order } from "@orbs/domain/twap";
import { createContext } from "react";

type OrderContextType = ReturnType<typeof useSpotOrder> & {
    order: Order;
  };
  
  export const OrderViewContext = createContext<OrderContextType>({} as OrderContextType);