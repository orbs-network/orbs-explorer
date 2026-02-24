import { createPublicClient, http } from "viem";
import * as chains from "viem/chains";
import { PARTNERS } from "./partners";

const getChain = (chainId?: number) => {
  if (!chainId) return undefined;
  return Object.values(chains).find((network) => network.id === chainId);
};

export const getPublicClient = (chainId: number) => {
  const chain = getChain(chainId);
  if (!chain) return undefined;
  return createPublicClient({
    chain,
    transport: http(
      `${process.env.NEXT_PUBLIC_RPC_URL}/rpc?chainId=${chainId}&appId=debug-tool`
    ),
  }) as ReturnType<typeof createPublicClient>;
};


export const getPartner = (id?: string) => {
  if (!id) return undefined;
  
  return PARTNERS.find((p) => p.identifiers.some(i => i.toLowerCase() === id.toLowerCase()));
};
