"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportOverviewErrors } from "@/lib/overview-error-notifications";

type ErrorStates = Parameters<typeof reportOverviewErrors>[1];

export function useOverviewErrorToasts({ orders, config }: ErrorStates) {
  const queryClient = useQueryClient();
  const {
    isPending: ordersPending,
    isError: ordersError,
    isFetching: ordersFetching,
    errorUpdatedAt: ordersErrorAt,
    dataUpdatedAt: ordersDataAt,
  } = orders;
  const {
    isPending: configPending,
    isError: configError,
    isFetching: configFetching,
    errorUpdatedAt: configErrorAt,
    dataUpdatedAt: configDataAt,
  } = config;

  useEffect(() => {
    reportOverviewErrors(
      queryClient,
      {
        orders: {
          isPending: ordersPending,
          isError: ordersError,
          isFetching: ordersFetching,
          errorUpdatedAt: ordersErrorAt,
          dataUpdatedAt: ordersDataAt,
        },
        config: {
          isPending: configPending,
          isError: configError,
          isFetching: configFetching,
          errorUpdatedAt: configErrorAt,
          dataUpdatedAt: configDataAt,
        },
      },
      (notice) =>
        toast.error(notice.title, {
          id: notice.id,
          description: notice.description,
          duration: 7_000,
          action: {
            label: "Retry",
            onClick: () => {
              void queryClient.refetchQueries({
                queryKey: notice.queryKey,
                exact: true,
              });
            },
          },
        }),
      (id) => toast.dismiss(id),
    );
  }, [
    queryClient,
    ordersPending,
    ordersError,
    ordersFetching,
    ordersErrorAt,
    ordersDataAt,
    configPending,
    configError,
    configFetching,
    configErrorAt,
    configDataAt,
  ]);
}
