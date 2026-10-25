import { queryInitialData } from "./main";

export const getSwapById = (sessionId: string) => {
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
                "type.keyword": "swap",
              },
            },
          ],
        },
      },
      size: 1,
    };
  };