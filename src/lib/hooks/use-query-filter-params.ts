"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import moment from "moment";
import { useEffect, useMemo } from "react";
import { useQueryParams, StringParam, ArrayParam } from "use-query-params";
import { URL_QUERY_KEYS } from "../consts";

export const useQueryFilterParams = () => {
  const [query, setQuery] = useQueryParams(
    {
      timeRange: StringParam,
      sessionType: StringParam,
      [URL_QUERY_KEYS.FEE_OUT_AMOUNT_USD]: StringParam,
      [URL_QUERY_KEYS.USER]: ArrayParam,
      [URL_QUERY_KEYS.HASH]: StringParam,
      [URL_QUERY_KEYS.TWAP_ADDRESS]: StringParam,
      [URL_QUERY_KEYS.IN_TOKEN]: ArrayParam,
      [URL_QUERY_KEYS.OUT_TOKEN]: ArrayParam,
      [URL_QUERY_KEYS.PARTNER_ID]: ArrayParam,
      [URL_QUERY_KEYS.CHAIN_ID]: ArrayParam,
      [URL_QUERY_KEYS.MIN_DOLLAR_VALUE]: StringParam,
      [URL_QUERY_KEYS.ORDER_STATUS]: ArrayParam,
      [URL_QUERY_KEYS.TIMESTAMP]: StringParam,
      [URL_QUERY_KEYS.ORDER_TYPE]: StringParam,
      [URL_QUERY_KEYS.SESSION_ID]: ArrayParam,
      [URL_QUERY_KEYS.STATUS]: StringParam,
    },
    {
      updateType: "pushIn",
    }
  );

  return useMemo(() => {
    return {
      query: {
        sessionType: query.sessionType,
        [URL_QUERY_KEYS.MIN_DOLLAR_VALUE]: query[
          URL_QUERY_KEYS.MIN_DOLLAR_VALUE
        ] as string | undefined,
        [URL_QUERY_KEYS.FEE_OUT_AMOUNT_USD]: query[
          URL_QUERY_KEYS.FEE_OUT_AMOUNT_USD
        ] as string | undefined,
        [URL_QUERY_KEYS.USER]: query[URL_QUERY_KEYS.USER] as string | undefined,
        [URL_QUERY_KEYS.HASH]: query[URL_QUERY_KEYS.HASH] as string | undefined,
        [URL_QUERY_KEYS.TWAP_ADDRESS]: query[URL_QUERY_KEYS.TWAP_ADDRESS] as
          | string
          | undefined,
        [URL_QUERY_KEYS.IN_TOKEN]: query[URL_QUERY_KEYS.IN_TOKEN] as
          | string[]
          | undefined,
        [URL_QUERY_KEYS.OUT_TOKEN]: query[URL_QUERY_KEYS.OUT_TOKEN] as
          | string[]
          | undefined,
        [URL_QUERY_KEYS.CHAIN_ID]: query[URL_QUERY_KEYS.CHAIN_ID] as
          | string[]
          | undefined,
        [URL_QUERY_KEYS.PARTNER_ID]: query[URL_QUERY_KEYS.PARTNER_ID] as
          | string[]
          | undefined,
        [URL_QUERY_KEYS.ORDER_STATUS]: query[URL_QUERY_KEYS.ORDER_STATUS] as
          | string[]
          | undefined,
        [URL_QUERY_KEYS.TIMESTAMP]: query[URL_QUERY_KEYS.TIMESTAMP] as
          | string
          | undefined,
        [URL_QUERY_KEYS.ORDER_TYPE]: query[URL_QUERY_KEYS.ORDER_TYPE] as
          | string
          | undefined,
        [URL_QUERY_KEYS.SESSION_ID]: query[URL_QUERY_KEYS.SESSION_ID] as
          | string[]
          | undefined,
        [URL_QUERY_KEYS.STATUS]: query[URL_QUERY_KEYS.STATUS] as
          | string
          | undefined,
      },
      setQuery: {
        updateQuery: (value: any) => setQuery(value),
        resetQuery: () => {
          Object.values(URL_QUERY_KEYS).forEach((key) => {
            setQuery({ [key]: undefined });
          });
        },
      },
    };
  }, [query, setQuery]);
};

export type QueryFilterParams = ReturnType<
  typeof useQueryFilterParams
>["query"];

export const useSetInitialTimestampFilter = (milliseconds: number) => {
  const { setQuery, query } = useQueryFilterParams();
  useEffect(() => {
    if (!query.timestamp) {
      setQuery.updateQuery({
        ...query,
        timestamp: moment().subtract(milliseconds, "milliseconds").valueOf(),
      });
    }
  }, [milliseconds, query, query.timestamp, setQuery]);
};
