import moment from "moment";

export const getDexFees = (
  dex: string,
  chainId: number,
  startDate?: number,
  endDate?: number
) => {

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
    aggs: {
      "0": {
        sum: {
          field: "feeOutAmountUsd",
        },
      },
    },
    size: 0,
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
        must: [],
        filter: [
          {
            bool: {
              should: [
                {
                  match: {
                    type: "swap",
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
          {
            match_phrase: {
              chainId: chainId,
            },
          },
          {
            match_phrase: {
              txStatus: "Mined",
            },
          },
          {
            match_phrase: {
              "dex.keyword": dex,
            },
          },
          ...dateFilter,
        ],
        should: [],
        must_not: [
          {
            match_phrase: {
              "user.keyword": "0xCbc71DF426b7f40779B9fca5eb1a8C92Ab546282",
            },
          },
          {
            match_phrase: {
              "user.keyword": "0xD607549CCC1B26a5992408DF73439C06e897A541",
            },
          },
        ],
      },
    },
  };
};
