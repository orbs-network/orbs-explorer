import { useQuery } from "@tanstack/react-query";
import {
  getPerpetualHubRollup,
  getPerpetualHubState,
  getPerpetualHubSummary,
  getPerpetualHubUser,
} from "@/lib/perpetual-hub/api";
import type {
  PerpetualHubOperation,
  PerpetualHubRollup,
} from "@/lib/perpetual-hub/types";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function useExplorerHome() {
  return useQuery({
    queryKey: ["explorerHome"],
    queryFn: ({ signal }) => getPerpetualHubSummary(signal),
    refetchInterval: 7_000,
    staleTime: 5_000,
  });
}

export function useExplorerBlock(seq: string | number) {
  return useQuery({
    queryKey: ["explorerBlock", String(seq)],
    queryFn: ({ signal }) => getPerpetualHubState(seq, signal),
    enabled: String(seq).length > 0,
    staleTime: 30_000,
  });
}

export function useExplorerBatch(id: string | number) {
  return useQuery({
    queryKey: ["explorerBatch", String(id)],
    queryFn: ({ signal }) => getPerpetualHubRollup(id, signal),
    enabled: String(id).length > 0,
    staleTime: 30_000,
  });
}

export function useExplorerAddress(address: string) {
  return useQuery({
    queryKey: ["explorerAddress", address],
    queryFn: ({ signal }) => getPerpetualHubUser(address, signal),
    enabled: ADDRESS_RE.test(address),
    staleTime: 30_000,
  });
}

type BlockBatchEnrichment = {
  rollup: PerpetualHubRollup;
  op: PerpetualHubOperation | undefined;
};

/**
 * Once a block's transition resolves to a rollupId, fetch that rollup so the
 * page can render L1 settlement metadata (txHash, blockNumber) and the full
 * op payload (address, amount, fee, status, …).
 */
export function useExplorerBlockBatch(
  rollupId: number | undefined,
  seq: number | undefined
) {
  return useQuery<BlockBatchEnrichment>({
    queryKey: ["explorerBlockBatch", rollupId ?? null, seq ?? null],
    queryFn: async ({ signal }) => {
      // queryFn only runs when `enabled` is true (both ids defined) — assert here.
      if (rollupId === undefined || seq === undefined) {
        throw new Error("rollupId/seq missing");
      }
      const data = await getPerpetualHubRollup(rollupId, signal);
      return {
        rollup: data.rollup,
        op: data.operations.find((o) => o.teeSequence === seq),
      };
    },
    enabled: rollupId !== undefined && seq !== undefined,
    staleTime: 60_000,
  });
}
