import { getPublicClient } from "@orbs/domain/lib";
import { Token } from "@orbs/domain/types";
import { getChain } from "@orbs/domain/utils/utils";
import { NextResponse } from "next/server";
import { erc20Abi } from "viem";
import { isNativeAddress } from "@orbs/domain/utils/utils";

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
  let payload: { addresses?: unknown; chainId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid token request" },
      { status: 400 },
    );
  }
  const { addresses, chainId } = payload ?? {};
  if (
    typeof chainId !== "number" ||
    !Number.isSafeInteger(chainId) ||
    chainId <= 0 ||
    !Array.isArray(addresses) ||
    !addresses.every(
      (address): address is string =>
        typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address),
    )
  ) {
    return NextResponse.json(
      { error: "A valid chain and token addresses are required" },
      { status: 400 },
    );
  }
  const publicClient = getPublicClient(chainId);
  // Historical orders can refer to chains missing from the current RPC registry.
  // An empty metadata result lets the UI retain the token address as its label.
  if (!publicClient) return NextResponse.json([]);

  const nativeToken = getChain(chainId)?.nativeCurrency;

  const output = new Array<Token | null>(addresses.length).fill(null);
  const toFetch: { address: string; outIndex: number }[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i].toLowerCase();

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
      {
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals" as const,
      },
      {
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: "name" as const,
      },
      {
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol" as const,
      },
    ]);

    let multicallResults;
    try {
      multicallResults = await publicClient.multicall({
        contracts,
        allowFailure: true,
      });
    } catch {
      return NextResponse.json(
        { error: "Token metadata is unavailable" },
        { status: 502 },
      );
    }

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
        // A failed symbol call must not become a permanent cached success.
        if (token.symbol.trim()) setCachedToken(chainId, token);
        output[toFetch[i].outIndex] = token;
      }
    }
  }

  return NextResponse.json(output.filter((t): t is Token => Boolean(t)));
}
