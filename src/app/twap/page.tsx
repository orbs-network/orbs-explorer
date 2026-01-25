"use client";


import { TwapOrdersTable } from "@/components/twap/table";
import { OrderSearchInput, OrdersFilter } from "@/components/twap/filter";
import { Page } from "@/components/page";

const Filter = () => {
  return (
    <>
      <OrderSearchInput className="max-w-[500px]" />
      <OrdersFilter />
    </>
  );
};

function TwapPage() {
  return (
    <Page filter={<Filter />}>
      <TwapOrdersTable />
    </Page>
  );
}

export default TwapPage;
