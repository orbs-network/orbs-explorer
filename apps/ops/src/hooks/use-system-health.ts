"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ORDER_SERVICES,
  serviceStatusQueryOptions,
} from "@orbs/domain/twap/service-status";
import {
  assessSystemHealth,
  HEALTH_REFRESH_INTERVAL_MS,
  parseSystemHealth,
} from "@/lib/system-health";

export function useSystemHealth() {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setClock(Date.now());
    };
    const timer = window.setInterval(update, 15_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const queries = useQueries({
    queries: ORDER_SERVICES.map((service) => ({
      ...serviceStatusQueryOptions(service.baseUrl),
      refetchInterval: HEALTH_REFRESH_INTERVAL_MS,
      refetchIntervalInBackground: false,
    })),
  });
  const now = Math.max(
    clock,
    ...queries.map((query) => query.data?.checkedAt || 0),
  );
  const services = queries.map((query, index) => {
    const snapshot = query.data ? parseSystemHealth(query.data) : undefined;
    return {
      ...ORDER_SERVICES[index],
      label:
        ORDER_SERVICES[index].id === "v2" ? "Order service" : "Legacy service",
      snapshot,
      checkedAgeMs: snapshot
        ? Math.max(0, now - snapshot.checkedAt)
        : undefined,
      assessment: snapshot ? assessSystemHealth(snapshot, now) : undefined,
      isPending: query.isPending,
      isFetching: query.isFetching,
      isError: query.isError,
      error: query.error,
      errorUpdatedAt: query.errorUpdatedAt,
    };
  });
  return {
    services,
    evaluatedAt: now,
    refreshIntervalMs: HEALTH_REFRESH_INTERVAL_MS,
    isRefreshing: queries.some((query) => query.isFetching),
    refresh: () => Promise.allSettled(queries.map((query) => query.refetch())),
  };
}

export type SystemHealthService = ReturnType<
  typeof useSystemHealth
>["services"][number];
