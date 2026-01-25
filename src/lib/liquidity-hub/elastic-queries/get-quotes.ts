import moment from "moment";
import { queryInitialData } from "./main";

export const getQuotes = ({
  startDate,
  endDate,
  page,
  limit,
}: {
  startDate?: number;
  endDate?: number;
  page: number;
  limit: number;
}) => {
  const dateFilter =
    startDate && endDate
      ? [
          {
            range: {
              timestamp: {
                format: "strict_date_optional_time",
                gte: moment(startDate).toISOString(),
                lte: moment(endDate).toISOString(),
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
          {
            term: {
              "type.keyword": "quote",
            },
          },

          ...dateFilter,
        ].filter(Boolean),

        must_not: [],
      },
    },
    size: limit,
    from: page * limit,
    sort: [
      {
        timestamp: {
          order: "desc",
        },
      },
    ],
  };
};
