import { isHash } from "viem";
import type { LiquidityHubQuote } from "./types";
import { elasticQueries } from "./elastic-queries";
import {
  LIQUIDITY_HUB_ELASTIC_CLIENT_URL,
  LIQUIDITY_HUB_ELASTIC_SERVER_URL,
} from "../consts";
import { fetchElastic } from "../api/fetch-elastic";
import type { LiquidityHubSwap } from "./types";

export async function getLiquidityHubTx(
  identifier: string,
  signal?: AbortSignal,
) {
  let query;
  if (isHash(identifier)) {
    query = elasticQueries.getSwapByTxHash(identifier);
  } else {
    query = elasticQueries.getSwapById(identifier);
  }

  const response = await fetchElastic<LiquidityHubSwap>(
    LIQUIDITY_HUB_ELASTIC_SERVER_URL,
    query,
    signal,
  );

  const swap = response[0];
  if (!swap) return;
  const { sessionId } = swap;

  const results = await Promise.allSettled([
    fetchElastic<LiquidityHubQuote>(
      LIQUIDITY_HUB_ELASTIC_SERVER_URL,
      elasticQueries.getSwapQuotesById(sessionId),
      signal,
    ),
    fetchElastic<unknown>(
      LIQUIDITY_HUB_ELASTIC_CLIENT_URL,
      elasticQueries.getClientBySessionId(sessionId),
      signal,
    ),
  ]);

  signal?.throwIfAborted();
  const quotes = results[0].status === "fulfilled" ? results[0].value : [];
  const clientLogs = results[1].status === "fulfilled" ? results[1].value : [];
  const warnings = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          `${index === 0 ? "Quote history is" : "Client logs are"} currently unavailable. Swap status is still shown.`,
        ]
      : [],
  );
  return {
    warnings,
    swap,
    quotes: quotes || [],
    clientLogs:
      (clientLogs as Array<{ timestamp: string }>)?.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ) || [],
    quote: quotes?.[quotes.length - 1] as LiquidityHubQuote | undefined,
  };
}
