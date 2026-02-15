import { useContext } from "react";
import { OrderViewContext } from "./context";

export const useOrderViewContext = () => {
  const context = useContext(OrderViewContext);
  if (!context) {
    throw new Error("useOrderViewContext must be used within a OrderViewContextProvider");
  }
  return context;
};      