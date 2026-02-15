import { PARTNERS } from "../partners";
import { Order, Partner, SpotOrderType } from "../types";
import { URL_QUERY_KEYS } from "../consts";
import { isValidWalletAddress, isNumeric } from "./utils";
import { isHash, maxUint256 } from "viem";
import moment from "moment";
import BN from "bignumber.js";

export const parseOrderType = (orderType?: string) => {
return orderType
};




export const getPartnersById = (partnerIds?: string[]): Partner[] => {
  if (!partnerIds) return [];
  return PARTNERS.filter((partner) => partnerIds.includes(partner.id));
};
export const validateOrderIdentifier = (value: string): boolean => {
  const val = value.split(",");
  for (const v of val) {
    if (!isValidWalletAddress(v) && !isHash(v) && !isNumeric(v)) {
      return false;
    }
  }
  return true;
};

export const resolveOrderIdentifier = (identifier: string) => {
  const parsedIdentifiers = identifier.split(",");

  const result: Record<string, string[] | undefined> = {};

  for (const value of parsedIdentifiers) {
    if (isValidWalletAddress(value)) {
      result[URL_QUERY_KEYS.USER] = [
        ...(result[URL_QUERY_KEYS.USER] || []),
        value,
      ];
    }
    if (isHash(value)) {
      result[URL_QUERY_KEYS.HASH] = [
        ...(result[URL_QUERY_KEYS.HASH] || []),
        value,
      ];
    }

  }

  return result;
};

export const millisToDuration = (value?: number) => {
  if (!value) {
    return "";
  }
  const time = moment.duration(value);
  const days = time.days();
  const hours = time.hours();
  const minutes = time.minutes();
  const seconds = time.seconds();

  const arr: string[] = [];

  if (days) {
    arr.push(`${days} days `);
  }
  if (hours) {
    arr.push(`${hours} hours `);
  }
  if (minutes) {
    arr.push(`${minutes} minutes`);
  }
  if (seconds) {
    arr.push(`${seconds} seconds`);
  }
  return arr.join(" ");
};



const getSpotOrderIsTakeProfit = (order?: Order) => {
  return BN(order?.order.witness.output.stop || "0").gte(maxUint256);
};

export const getSpotOrderType = (order?: Order) => {
  const isLimitPrice = BN(order?.order.witness.output.limit || "0").gt(1);
  const isTakeProfit = getSpotOrderIsTakeProfit(order);
  const isStopLoss = BN(order?.order.witness.output.stop || "0").lt(maxUint256);
  const chunks = order?.metadata.chunks;
  const isTWAP = (chunks?.length || 0) > 1;
  if (isTakeProfit) {
    return SpotOrderType.TAKE_PROFIT;
  }
  if (isLimitPrice) {
    if(isStopLoss) {
      return SpotOrderType.STOP_LOSS_LIMIT;
    }
    if(isTWAP) {
      return SpotOrderType.TWAP_LIMIT;
    }
    return SpotOrderType.LIMIT;
  }

  if(isStopLoss) {
    return SpotOrderType.STOP_LOSS_MARKET;
  }

  return SpotOrderType.TWAP_MARKET;
};


export const getSpotOrderTriggerPrice = (order?: Order) => {
  if (getSpotOrderIsTakeProfit(order)) {
    return order?.order.witness.output.limit || "0"; 
  }
  return order?.order.witness.output.stop || "0";
};

export const getSpotOrderLimitPrice = (order?: Order) => {
  const isTakeProfit = getSpotOrderIsTakeProfit(order);
  if (isTakeProfit) {
    return '0'
  }
  return order?.order.witness.output.limit || "0";
};