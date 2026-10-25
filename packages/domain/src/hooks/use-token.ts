import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Token } from "../types";
import {
  hasTokenSymbol,
  isValidTokenReference,
  preloadTokenMetadata,
  TOKEN_FAILURE_STALE_TIME,
  tokenQueryKey,
} from "../token-metadata";

export const useToken = (
  address?: string,
  chainId?: number,
  disabled = false,
) => {
  const queryClient = useQueryClient();
  const query = useQuery<Token | null>({
    queryKey: tokenQueryKey(address, chainId),
    queryFn: async ({ signal }) => {
      await preloadTokenMetadata(queryClient, [{ address, chainId }], signal);
      return (
        queryClient.getQueryData<Token | null>(
          tokenQueryKey(address, chainId),
        ) ?? null
      );
    },
    enabled: isValidTokenReference({ address, chainId }) && !disabled,
    staleTime: (query) =>
      hasTokenSymbol(query.state.data) ? Infinity : TOKEN_FAILURE_STALE_TIME,
    gcTime: 24 * 60 * 60 * 1000,
  });
  return { ...query, data: query.data ?? undefined };
};

export const useTokens = (addresses?: string[], chainId?: number) => {
  const queryClient = useQueryClient();
  const normalized = [
    ...new Set(addresses?.map((address) => address.toLowerCase())),
  ];
  return useQuery({
    queryKey: ["useTokens", normalized, chainId],
    queryFn: async ({ signal }) => {
      await preloadTokenMetadata(
        queryClient,
        normalized.map((address) => ({ address, chainId })),
        signal,
      );
      return normalized.flatMap((address) => {
        const token = queryClient.getQueryData<Token | null>(
          tokenQueryKey(address, chainId),
        );
        return token ? [token] : [];
      });
    },
    enabled:
      normalized.length > 0 &&
      normalized.every((address) =>
        isValidTokenReference({ address, chainId }),
      ),
    staleTime: TOKEN_FAILURE_STALE_TIME,
  });
};
