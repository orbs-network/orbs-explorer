import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import _ from "lodash";
import { Token } from "../types";
import * as chains from 'viem/chains'
import { getChain, isNativeAddress } from "../utils/utils";
import { zeroAddress } from "viem";



const getLogoUrl = (name: string) => {
 try {
  return  `https://static.arkhamintelligence.com/tokens/${
    name
    ?.toLowerCase()
    .replace(/usd₮0/g, 'usdt0')        // usd₮0 → usdt0
    .replace(/\(.*?\)/g, '')           // remove (text)
    .replace(/\susd$/, '')             // remove trailing " usd"
    .replace(/\s+/g, '-')              // spaces → "-"
    .replace(/-+/g, '-')               // collapse multiple dashes
    .replace(/^-|-$/g, '')             // trim dashes
    .replace(/^wrapped-bnb$/, 'wbnb')  // wrapped-bnb → wbnb
    .replace(/^usdc$/, 'usd-coin')     // usdc → usd-coin
  }.png`
 } catch (error) {
  return ''
 }
}

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
        logoUrl: getLogoUrl(token.name),
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
