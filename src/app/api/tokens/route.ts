import { getPublicClient } from "@/lib/lib";
import { Token } from "@/lib/types";
import { getChain } from "@/lib/utils/utils";
import { NextResponse } from "next/server";
import { erc20Abi } from "viem";
import { isNativeAddress } from "@orbs-network/spot-ui";

const cache = new Map<number, Map<string, Token>>();
const normalizeAddress = (addr: string) => addr.toLowerCase();

const getCachedToken = (chainId: number, address: string) =>
  cache.get(chainId)?.get(normalizeAddress(address));

const setCachedToken = (chainId: number, token: Token) => {
  const chainCache = cache.get(chainId) ?? new Map<string, Token>();
  chainCache.set(normalizeAddress(token.address), token);
  cache.set(chainId, chainCache);
};

export async function POST(request: Request) {
  const { addresses, chainId }: { addresses: string[]; chainId: number } =
    await request.json();

  const publicClient = getPublicClient(chainId);
  if (!publicClient) throw new Error("Public client not found");

  const nativeToken = getChain(chainId)?.native;

  const output = new Array<Token | null>(addresses.length).fill(null);
  const toFetch: { address: string; outIndex: number }[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];

    if (isNativeAddress(address)) {
      output[i] = {
        address,
        decimals: nativeToken?.decimals ?? 18,
        name: "",
        symbol: nativeToken?.symbol ?? "",
      };
      continue;
    }

    const cached = getCachedToken(chainId, address);
    if (cached) output[i] = cached;
    else toFetch.push({ address, outIndex: i });
  }

  if (toFetch.length) {
    const contracts = toFetch.flatMap(({ address }) => [
      { address: address as `0x${string}`, abi: erc20Abi, functionName: "decimals" as const },
      { address: address as `0x${string}`, abi: erc20Abi, functionName: "name" as const },
      { address: address as `0x${string}`, abi: erc20Abi, functionName: "symbol" as const },
    ]);

    const multicallResults = await publicClient.multicall({
      contracts,
      allowFailure: true,
    });

    for (let i = 0; i < toFetch.length; i++) {
      const offset = i * 3;
      const decimals = multicallResults[offset]?.result as number | undefined;
      const name = multicallResults[offset + 1]?.result as string | undefined;
      const symbol = multicallResults[offset + 2]?.result as string | undefined;

      if (decimals !== undefined) {
        const token: Token = {
          address: toFetch[i].address,
          decimals,
          name: name ?? "",
          symbol: symbol ?? "",
        };
        setCachedToken(chainId, token);
        output[toFetch[i].outIndex] = token;
      }
    }
  }

  return NextResponse.json(output.filter((t): t is Token => Boolean(t)));
}
