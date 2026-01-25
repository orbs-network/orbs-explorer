
import { OrderView } from "@/components/twap/order-view/order-view";
import { use } from "react";

const OrderPage = ({ params }: { params: Promise<{ hash: string }> }) => {
  const { hash } = use(params);
  return <OrderView hash={hash} />;
};

export default OrderPage;