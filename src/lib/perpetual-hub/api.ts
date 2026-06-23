import type {
  PerpetualHubEventDetail,
  PerpetualHubEventList,
  PerpetualHubEventListFilters,
  PerpetualHubHedgerPositionList,
  PerpetualHubHedgerPositionListFilters,
  PerpetualHubPositionList,
  PerpetualHubPositionListFilters,
  PerpetualHubRiskList,
  PerpetualHubRiskListFilters,
  PerpetualHubRollupDetail,
  PerpetualHubRollup,
  PerpetualHubRollupList,
  PerpetualHubRollupListFilters,
  PerpetualHubStateDetail,
  PerpetualHubSummary,
  PerpetualHubUserDetail,
  PerpetualHubUserListFilters,
  PerpetualHubUsers,
} from "./types";

type PerpetualHubSummaryFilters = {
  chain_id?: string | string[];
  partner_id?: string;
};

function isAbortSignal(value: unknown): value is AbortSignal {
  return typeof value === "object" && value !== null && "aborted" in value;
}

export async function getPerpetualHubSummary(
  filtersOrSignal?: PerpetualHubSummaryFilters | AbortSignal,
  signal?: AbortSignal,
): Promise<PerpetualHubSummary> {
  const filters = isAbortSignal(filtersOrSignal) ? undefined : filtersOrSignal;
  const requestSignal = isAbortSignal(filtersOrSignal)
    ? filtersOrSignal
    : signal;
  const query = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((item) => query.append(key, item));
      } else if (value) {
        query.set(key, value);
      }
    }
  }
  const suffix = query.size ? `?${query}` : "";
  const response = await fetch(`/api/perpetual-hub/summary${suffix}`, {
    signal: requestSignal,
  });
  if (!response.ok) {
    throw new Error(
      `Failed to load Perpetual Hub summary (${response.status})`,
    );
  }
  return response.json();
}

export async function getPerpetualHubState(
  seq: string | number,
  signal?: AbortSignal,
  filters?: {
    chain_id?: string;
    partner_id?: string;
    contract?: string;
  },
): Promise<PerpetualHubStateDetail> {
  const query = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
  }
  const suffix = query.size ? `?${query}` : "";
  const response = await fetch(`/api/perpetual-hub/state/${seq}${suffix}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub state (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubRollup(
  id: string | number,
  signal?: AbortSignal,
  filters?: {
    chain_id?: string;
    partner_id?: string;
    contract?: string;
  },
): Promise<PerpetualHubRollupDetail> {
  const query = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
  }
  const suffix = query.size ? `?${query}` : "";
  const response = await fetch(`/api/perpetual-hub/rollup/${id}${suffix}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub rollup (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubUser(
  address: string,
  signal?: AbortSignal,
  filters?: {
    chain_id?: string;
    partner_id?: string;
    contract?: string;
  },
): Promise<PerpetualHubUserDetail> {
  const query = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
  }
  const suffix = query.size ? `?${query}` : "";
  const response = await fetch(`/api/perpetual-hub/user/${address}${suffix}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub user (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubEvent(
  id: string | number,
  signal?: AbortSignal,
  filters?: {
    chain_id?: string;
    partner_id?: string;
    contract?: string;
    seq?: string;
  },
): Promise<PerpetualHubEventDetail> {
  const query = new URLSearchParams();
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
  }
  const suffix = query.size ? `?${query}` : "";
  const response = await fetch(`/api/perpetual-hub/event/${id}${suffix}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub event (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubUsers(
  params?: {
    limit?: number;
    offset?: number;
    filters?: PerpetualHubUserListFilters;
  },
  signal?: AbortSignal,
): Promise<PerpetualHubUsers> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value) query.set(key, value);
    }
  }
  const suffix = query.size ? `?${query}` : "";
  const response = await fetch(`/api/perpetual-hub/users${suffix}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub users (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubRollupByRoot(
  root: string,
  signal?: AbortSignal,
): Promise<{ rollup: PerpetualHubRollup }> {
  const response = await fetch(`/api/perpetual-hub/rollup-root/${root}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to find rollup root (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubRollups(
  params: {
    limit: number;
    offset: number;
    filters?: PerpetualHubRollupListFilters;
  },
  signal?: AbortSignal,
): Promise<PerpetualHubRollupList> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value) query.set(key, value);
    }
  }
  const response = await fetch(`/api/perpetual-hub/rollups?${query}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load rollups (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubRisk(
  params: {
    limit: number;
    offset: number;
    filters?: PerpetualHubRiskListFilters;
  },
  signal?: AbortSignal,
): Promise<PerpetualHubRiskList> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value) query.set(key, value);
    }
  }
  const response = await fetch(`/api/perpetual-hub/risk?${query}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load risk rows (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubHedgerPositions(
  params: {
    limit: number;
    offset: number;
    filters?: PerpetualHubHedgerPositionListFilters;
  },
  signal?: AbortSignal,
): Promise<PerpetualHubHedgerPositionList> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value) query.set(key, value);
    }
  }
  const response = await fetch(`/api/perpetual-hub/hedger?${query}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load hedger positions (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubEvents(
  params: {
    limit: number;
    offset: number;
    filters?: PerpetualHubEventListFilters;
  },
  signal?: AbortSignal,
): Promise<PerpetualHubEventList> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((item) => query.append(key, item));
      } else if (value) {
        query.set(key, value);
      }
    }
  }
  const response = await fetch(`/api/perpetual-hub/events?${query}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load events (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubPositions(
  params: {
    limit: number;
    offset: number;
    filters?: PerpetualHubPositionListFilters;
  },
  signal?: AbortSignal,
): Promise<PerpetualHubPositionList> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value) query.set(key, value);
    }
  }
  const response = await fetch(`/api/perpetual-hub/positions?${query}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load positions (${response.status})`);
  }
  return response.json();
}
