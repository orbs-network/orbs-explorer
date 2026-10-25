import { getSwapByTxHash } from "./get-swap-by-hash";
import { getSwapById } from "./get-swap-by-id";
import { getSwapQuotesById } from "./get-quotes-by-id";
import { getClientBySessionId } from "./get-client-logs-by-id";
import { getSwaps } from "./get-swap";
import { getTotalSwapsVolume } from "./get-total-swaps-volume";
import { getTotalFees } from "./get-total-fees";
import { getTotalSwap } from "./get-total-swap";
import { getUniqueSwappers } from "./get-unique-swappers";
import { getDexVolume } from "./get-dex-volume";
import { getDexFees } from "./get-dex-fees";
import { getQuotes } from "./get-quotes";
import { getSwapsCountByStatus } from "./get-swaps-count-by-status";
import { getClientLogs } from "./get-client-logs";

export const elasticQueries = {
  getSwapByTxHash,
  getSwapById,
  getSwapQuotesById,
  getClientBySessionId,
  getSwaps,
  getTotalSwapsVolume,
  getTotalFees,
  getTotalSwap,
  getUniqueSwappers,
  getDexVolume,
  getDexFees,
  getQuotes,
  getSwapsCountByStatus,
  getClientLogs,
};