import React, { useMemo } from 'react'
import { getPartner } from '../utils/utils';

export function usePartner(id?: string) {

  return useMemo(() => id ? getPartner(id) : undefined, [id]);
}