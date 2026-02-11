import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import _ from "lodash";
import { Token } from "../types";
import * as chains from 'viem/chains'
import { getTokenLogo } from "../api";

const coingekoChainToName = {
  [chains.flare.id]: "flare-network",
  [chains.fantom.id]: "fantom",
  [chains.arbitrum.id]: "arbitrum-one",
  [chains.polygon.id]: "polygon-pos",
  [chains.base.id]: "base",
  [chains.mainnet.id]: "ethereum",
  [chains.bsc.id]: "binance-smart-chain",
  [chains.linea.id]: "linea",
  [chains.sonic.id]: "sonic",
  [chains.cronoszkEVM.id]: "cronos-zkevm",
  [chains.katana.id]: "katana",
  [chains.sei.id]: "sei-v2",
  [chains.berachain.id]: "berachain",
  [chains.monad.id]: "monad",
  [chains.avalanche.id]: "avalanche",
};



export const useToken = (
  address?: string,
  chainId?: number,
  disabled = false
) => {
  return  useQuery({
    queryKey: ["useToken", address, chainId],
    queryFn: async () => {
      const response = await fetch("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ addresses: [address], chainId }),
      });
      const data = await response.json();
      
      return data[0] as Token;
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
