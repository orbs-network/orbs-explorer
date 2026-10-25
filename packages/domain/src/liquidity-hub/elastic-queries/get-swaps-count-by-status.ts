import moment from "moment";

export const getSwapsCountByStatus = ({
  dex,
  chainId,
  startDate,
  endDate,
  status = "success",
}: {
  dex: string;
  chainId: number;
  startDate?: number;
  endDate?: number;
  status?: "success" | "failed";
}) => {
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
    size: 0, // important to exclude documents from the hits
    aggs: {
      successSwaps: {
        filter: {
          term: {
            "swapStatus.keyword": status,
          },
        },
      },
    },
    fields: [
      {
        field: "timestamp",
        format: "date_time",
      },
    ],
    script_fields: {},
    stored_fields: ["*"],
    runtime_mappings: {},
    _source: {
      excludes: [],
    },
    query: {
      bool: {
        filter: [
          {
            match_phrase: { chainId },
          },
          {
            match_phrase: { dex },
          },
          {
            match_phrase: { type: "swap" },
          },
          ...dateFilter,
        ],
      },
    },
  };
};
