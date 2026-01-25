import React from 'react'
import { getUSDPrice } from '../api/fetch-usd-price';
import { useQuery } from '@tanstack/react-query';

export const usePriceUsd = (address?: string, chainId?: number) => {
  return useQuery({
    queryKey: ["usePriceUsd", chainId],
    queryFn: async () => {
        const res = await getUSDPrice([address!], chainId!);
        return res[address!] || 0;
    },
    enabled: !!address && !!chainId,
  });
}