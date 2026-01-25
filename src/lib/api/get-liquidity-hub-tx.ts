import { isHash } from "viem";
import { LiquidityHubQuote } from "../liquidity-hub/types";
import { elasticQueries } from "../liquidity-hub/elastic-queries";
import { LIQUIDITY_HUB_ELASTIC_CLIENT_URL, LIQUIDITY_HUB_ELASTIC_SERVER_URL } from "../consts";
import { fetchElastic } from ".";
import { LiquidityHubSwap } from "../liquidity-hub";

export const getLiquidityHubTx = async (identifier: string, signal?: AbortSignal) => {
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
  if (!swap) throw new Error("Swap not found");
  const { sessionId } = swap;

  const [quotes, clientLogs] = [
    await fetchElastic<LiquidityHubQuote>(
      LIQUIDITY_HUB_ELASTIC_SERVER_URL,
      elasticQueries.getSwapQuotesById(sessionId),
      signal,
    ),
    await fetchElastic<any>(
      LIQUIDITY_HUB_ELASTIC_CLIENT_URL,
      elasticQueries.getClientBySessionId(sessionId),
      signal,
    ),
  ];
  return {
    swap,
    quotes: quotes || [],
    clientLogs:
      clientLogs?.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ) || [],
    quote: quotes[quotes.length - 1] as LiquidityHubQuote | undefined,
  };
};
