import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import _ from "lodash";
import { Token } from "../types";
import * as chains from 'viem/chains'
import { getTokenLogo } from "../api";
import { getChain, isNativeAddress } from "../utils/utils";
import { zeroAddress } from "viem";



export const useToken = (
  address?: string,
  chainId?: number,
  disabled = false
) => {
  return  useQuery({
    queryKey: ["useToken", address, chainId],
    queryFn: async () => {

      if(isNativeAddress(address!)) {
        const nativeToken = getChain(chainId)?.nativeCurrency;
        return {
          address: zeroAddress,
          decimals: nativeToken?.decimals,
          name: nativeToken?.name,
          symbol: nativeToken?.symbol,
        } as Token;
      }

      const response = await fetch("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ addresses: [address], chainId }),
      });
      const data = await response.json();
      const token = data[0];
      return {
        ...token,
        logoUrl: `https://static.arkhamintelligence.com/tokens/${
          token.name
            ?.toLowerCase()
            .replace(/usd₮0/g, 'usdt0')  // usd₮0 → usdt0
            .replace(/\susd$/, '')       // remove trailing " usd"
            .replace(/\s+/g, '-')        // spaces → "-"
        }.png`,
      } as Token;
    },
    enabled: !!address && !!chainId && !disabled,
    staleTime: Infinity,
  });
};



export const useTokens = (
  _addresses?: string[],
  chainId?: number,
) => {
  return  useQuery({
    queryKey: ["useTokens", _addresses, chainId],
    queryFn: async () => {
      const addresses = _.uniq(_addresses);
      const response = await fetch("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ addresses, chainId }),
      });
      const data = await response.json();
      
      return data as Token[];
    },
    enabled: !!_addresses && !!chainId,
    staleTime: Infinity,
  });
};
