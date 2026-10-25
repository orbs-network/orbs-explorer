import { queryInitialData } from "./main";

export const getSwapQuotesById = (sessionId: string) => {
    return {
      ...queryInitialData,
      query: {
        bool: {
          filter: [
            {
              term: {
                "sessionId.keyword": sessionId,
              },
            },
            {
              term: {
                "type.keyword": "quote",
              },
            },
          ],
        },
      },
    };
  };
  