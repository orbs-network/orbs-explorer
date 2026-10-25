import axios from "axios";
import { queryOptions } from "@tanstack/react-query";
import { CURRENT_SINK_API_URL, SINK_API_URLS } from "./api";

export const ORDER_SERVICES = [
  { id: "v2", label: "Current service", baseUrl: CURRENT_SINK_API_URL },
  { id: "v1", label: "Original service", baseUrl: SINK_API_URLS.prod },
] as const;

export type OrderService = (typeof ORDER_SERVICES)[number];
export type ServiceStatusResponse = {
  payload: Record<string, unknown>;
  checkedAt: number;
  latencyMs: number;
};

export class ServiceStatusError extends Error {
  constructor(
    message: string,
    readonly kind: "http" | "timeout" | "network" | "invalid",
  ) {
    super(message);
    this.name = "ServiceStatusError";
  }
}

export async function getServiceStatus(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<ServiceStatusResponse> {
  signal?.throwIfAborted();
  const startedAt = Date.now();
  try {
    const response = await axios.get<unknown>(`${baseUrl}/status`, {
      signal,
      timeout: 10_000,
    });
    signal?.throwIfAborted();
    if (
      !response.data ||
      typeof response.data !== "object" ||
      Array.isArray(response.data)
    ) {
      throw new ServiceStatusError("Unexpected status response", "invalid");
    }
    return {
      payload: response.data as Record<string, unknown>,
      checkedAt: Date.now(),
      latencyMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof ServiceStatusError) throw error;
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        throw new ServiceStatusError(
          "No response within 10 seconds",
          "timeout",
        );
      }
      if (error.response) {
        throw new ServiceStatusError(
          `Status endpoint returned HTTP ${error.response.status}`,
          "http",
        );
      }
    }
    throw new ServiceStatusError(
      "Status endpoint could not be reached",
      "network",
    );
  }
}

/** Shared by the catalog and live health view; failures retain their error state. */
export function serviceStatusQueryOptions(baseUrl: string) {
  return queryOptions({
    queryKey: ["order-service-status", baseUrl],
    queryFn: ({ signal }) => getServiceStatus(baseUrl, signal),
    staleTime: (query) => (query.state.status === "error" ? 0 : 60_000),
    gcTime: 10 * 60_000,
    retry: false,
  });
}
