import { OrderView } from "@/components/twap/order-view/order-view";
import { ROUTES } from "@/lib/routes";
import { use } from "react";

const OrderPage = ({
  params,
  searchParams,
}: {
  params: Promise<{ hash: string }>;
  searchParams: Promise<{ from?: string }>;
}) => {
  const { hash } = use(params);
  const { from } = use(searchParams);
  const backHref = from === "orders-dashboard" ? ROUTES.ORDERS_DASHBOARD : undefined;
  return (
    <OrderView
      hash={hash}
      backHref={backHref}
      defaultBackHref={ROUTES.TWAP.ROOT}
    />
  );
};

export default OrderPage;