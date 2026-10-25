"use client";
import { OrdersList } from "@/components/investigation/orders-list";
export function PartnerOrders() {
  return <OrdersList embedded />;
}
export function PartnerOrderLookup() {
  return <PartnerOrders />;
}
