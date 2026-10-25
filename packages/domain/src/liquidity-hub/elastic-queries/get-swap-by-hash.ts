import { queryInitialData } from "./main";

export const getSwapByTxHash = (txHash: string) => {
    return {
      ...queryInitialData,
      query: {
        bool: {
          filter: [
            {
              term: {
                "txHash.keyword": txHash,
              },
            },
            {
              term: {
                "type.keyword": "swap",
              },
            },
          ],
        },
      },
      size: 1,
    };
  };
  