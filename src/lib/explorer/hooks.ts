import { useQuery } from "@tanstack/react-query";
import { getPerpetualHubSummary } from "@/lib/perpetual-hub/api";

export function useExplorerHome() {
  return useQuery({
    queryKey: ["explorerHome"],
    queryFn: ({ signal }) => getPerpetualHubSummary(signal),
    refetchInterval: 7_000,
    staleTime: 5_000,
  });
}
