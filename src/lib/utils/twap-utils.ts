import { PARTNERS } from "../partners";
import { Partner } from "../types";
import { URL_QUERY_KEYS } from "../consts";
import { isValidWalletAddress, isNumeric } from "./utils";
import { isHash } from "viem";
import moment from "moment";

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
