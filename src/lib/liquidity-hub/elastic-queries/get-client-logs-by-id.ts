import { queryInitialData } from "./main";
export const getClientBySessionId = (sessionId: string) => {
  return {
    ...queryInitialData,
    query: {
      bool: {
        filter: [
          {
            bool: {
              should: [
                { term: { "sessionId.keyword": sessionId } },
                { term: { "liquidityHubId.keyword": sessionId } },
              ],
              minimum_should_match: 1, // ensures at least one condition must match
            },
          },
        ],
      },
    },
    sort: [
      {
        timestamp: {
          order: "desc",
        },
      },
    ],
  };
};