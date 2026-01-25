import React, { useMemo } from 'react'
import { PARTNERS } from '../partners';
import { getPartnersById } from '../utils/utils';

export function usePartner(id?: string) {

  return useMemo(() => id ? getPartnersById([id])?.[0] : undefined, [id]);
}