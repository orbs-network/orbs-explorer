import { OrderView } from "@/components/twap/order-view/order-view";
import { ROUTES } from "@/routes";
import { use } from "react";

const OrderPage = ({
  params,
}: {
  params: Promise<{ hash: string }>;
}) => {
  const { hash } = use(params);
  return (
    <main id="main-content" className="min-w-0">
      <OrderView
        hash={hash}
        defaultBackHref={ROUTES.TWAP.ROOT}
      />
    </main>
  );
};

export default OrderPage;
