import { createPublicClient, fallback, http } from "viem";
import * as chains from "viem/chains";
import { PARTNERS } from "./partners";
import { EXTRA_CHAINS } from "./extra-chains";

const getChain = (chainId?: number) => {
  if (!chainId) return undefined;
  return (
    Object.values(chains).find((network) => network.id === chainId) ??
    EXTRA_CHAINS.find((network) => network.id === chainId)
  );
};

export const getPublicClient = (chainId: number) => {
  const chain = getChain(chainId);
  if (!chain) return undefined;
  const rpcBaseUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
  const urls = [
    ...new Set([
      ...(rpcBaseUrl
        ? [
            `${rpcBaseUrl.replace(/\/$/, "")}/rpc?chainId=${chainId}&appId=debug-tool`,
          ]
        : []),
      ...chain.rpcUrls.default.http,
    ]),
  ];
  return createPublicClient({
    chain,
    // Keep metadata available when the proxy is unset, offline, or does not
    // support a chain. Bound each attempt to fit inside the token API timeout.
    transport: fallback(
      urls.map((url) => http(url, { timeout: 3_000, retryCount: 0 })),
      { retryCount: 0 },
    ),
  }) as ReturnType<typeof createPublicClient>;
};

export const getPartner = (id?: string) => {
  if (!id) return undefined;

  return PARTNERS.find((p) =>
    p.identifiers.some((i) => i.toLowerCase() === id.toLowerCase()),
  );
};
