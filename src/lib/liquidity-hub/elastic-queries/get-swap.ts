import moment from "moment";
import { queryInitialData } from "./main";
import { keywordScriptFilter } from "../helpers";

type GetSwapsParams = {
  chainId?: string[];
  page: number;
  limit: number;
  walletAddress?: string[];
  dex?: string[];
  minDollarValue?: string;
  inToken?: string[];
  outToken?: string[];
  sessionId?: string[];
  startDate?: number;
  endDate?: number;
  feeOutAmountUsd?: string;
  txHash?: string[];
  status?: "success" | "failed";
};

export const getSwaps = ({
  page,
  limit,
  chainId,
  walletAddress,
  dex,
  minDollarValue,
  inToken,
  outToken,
  sessionId,
  startDate,
  endDate,
  feeOutAmountUsd,
  txHash,
  status,
}: GetSwapsParams) => {
  const dateFilter =
    startDate || endDate
      ? [
          {
            range: {
              timestamp: {
                format: "strict_date_optional_time",
                ...(startDate && { gte: moment(startDate).toISOString() }),
                ...(endDate && { lte: moment(endDate).toISOString() }),
              },
            },
          },
        ]
      : [];

  return {
    ...queryInitialData,
    query: {
      bool: {
        filter: [
          chainId?.length && {
            terms: { chainId },
          },
          walletAddress?.length &&
            keywordScriptFilter("user.keyword", walletAddress),
          dex?.length && keywordScriptFilter("dex.keyword", dex),
          txHash?.length && keywordScriptFilter("txHash.keyword", txHash),
          {
            term: {
              "type.keyword": "swap",
            },
          },
          inToken?.length &&
            keywordScriptFilter("tokenInName.keyword", inToken),
          outToken?.length &&
            keywordScriptFilter("tokenOutName.keyword", outToken),
          status &&
            keywordScriptFilter("swapStatus.keyword", [status]),
          sessionId?.length && {
            terms: {
              "sessionId.keyword": sessionId,
            },
          },
          ...dateFilter,
          status?.includes("success") && {
            exists: { field: "txHash.keyword" },
          },
          {
            exists: { field: "swapStatus.keyword" },
          },
          minDollarValue && {
            range: {
              dollarValue: {
                gt: minDollarValue,
              },
            },
          },
          feeOutAmountUsd && {
            range: {
              feeOutAmountUsd: {
                gt: feeOutAmountUsd,
              },
            },
          },
        ].filter(Boolean),
        must_not: [
          status?.includes("success") && {
            term: { "txHash.keyword": "" },
          },
          {
            term: { "swapStatus.keyword": "" },
          },
        ].filter(Boolean),
      },
    },
    size: limit,
    from: Math.max(0, page * limit),
    sort: [
      {
        timestamp: {
          order: "desc",
        },
      },
    ],
    track_total_hits: true,
  };
};
