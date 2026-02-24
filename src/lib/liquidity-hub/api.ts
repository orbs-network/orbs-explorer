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
  signal?: AbortSignal
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
    signal
  );

  const swap = response[0];
  if (!swap) return;
  const { sessionId } = swap;

  const [quotes, clientLogs] = await Promise.all([
    fetchElastic<LiquidityHubQuote>(
      LIQUIDITY_HUB_ELASTIC_SERVER_URL,
      elasticQueries.getSwapQuotesById(sessionId),
      signal
    ),
    fetchElastic<unknown>(
      LIQUIDITY_HUB_ELASTIC_CLIENT_URL,
      elasticQueries.getClientBySessionId(sessionId),
      signal
    ),
  ]);

  return {
    swap,
    quotes: quotes || [],
    clientLogs:
      (clientLogs as Array<{ timestamp: string }>)?.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ) || [],
    quote: quotes?.[quotes.length - 1] as LiquidityHubQuote | undefined,
  };
}
