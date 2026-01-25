import moment from "moment";
import { queryInitialData } from "./main";

export const getClientLogs = ({
  startDate,
  endDate,
  limit,
  page,
}: {
  startDate?: number;
  endDate?: number;
  limit: number;
  page: number;
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
    query: {
      bool: {
        filter: [
          ...dateFilter,
        ],
      },
    },
  };
};
