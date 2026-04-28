import { useQuery } from "@tanstack/react-query";
import {
  getPerpetualHubRollup,
  getPerpetualHubState,
  getPerpetualHubSummary,
  getPerpetualHubUser,
} from "./api";

export function usePerpetualHubSummary() {
  return useQuery({
    queryKey: ["perpetualHubSummary"],
    queryFn: ({ signal }) => getPerpetualHubSummary(signal),
    refetchInterval: 10_000,
  });
}

export function usePerpetualHubState(seq: string | number) {
  return useQuery({
    queryKey: ["perpetualHubState", String(seq)],
    queryFn: ({ signal }) => getPerpetualHubState(seq, signal),
    enabled: String(seq).length > 0,
  });
}

export function usePerpetualHubRollup(id: string | number) {
  return useQuery({
    queryKey: ["perpetualHubRollup", String(id)],
    queryFn: ({ signal }) => getPerpetualHubRollup(id, signal),
    enabled: String(id).length > 0,
  });
}

export function usePerpetualHubUser(address: string) {
  return useQuery({
    queryKey: ["perpetualHubUser", address],
    queryFn: ({ signal }) => getPerpetualHubUser(address, signal),
    enabled: /^0x[a-fA-F0-9]{40}$/.test(address),
  });
}
