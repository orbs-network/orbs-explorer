/**
 * Application routes constants and helper functions
 * Use these instead of hardcoded strings for navigation
 */

export const ROUTES = {
  HOME: "/",
  TWAP: {
    ROOT: "/twap",
    ORDER: (hash: string) => `/twap/order/${hash}`,
  },
  LIQUIDITY_HUB: {
    ROOT: "/liquidity-hub",
    TX: (identifier: string) => `/liquidity-hub/tx/${identifier}`,
  },
  PERPETUAL_HUB: {
    ROOT: "/perpetual-hub",
    ACTIONS: "/perpetual-hub/actions",
    POSITIONS: "/perpetual-hub/positions",
    DASHBOARD: "/perpetual-hub/dashboard",
    RISK: "/perpetual-hub/risk",
    USERS: "/perpetual-hub/users",
    HEDGER: "/perpetual-hub/hedger",
    ROLLUPS: "/perpetual-hub/rollups",
    EVENTS: "/perpetual-hub/events",
    EVENT: (id: number | string) => `/perpetual-hub/event/${id}`,
    STATE: (seq: number | string) => `/perpetual-hub/state/${seq}`,
    ROLLUP: (id: number | string) => `/perpetual-hub/rollup/${id}`,
    USER: (address: string) => `/perpetual-hub/user/${address}`,
  },
  ORDERS_DASHBOARD: "/twap/overview",
  LIQUIDITY_HUB_DASHBOARD: "/liquidity-hub-dashboard",
  EXPLORER: {
    ROOT: "/explorer",
    BLOCKS: "/explorer/blocks",
    BATCHES: "/explorer/batches",
    BLOCK: (seq: number | string) => `/explorer/block/${seq}`,
    BATCH: (id: number | string) => `/explorer/batch/${id}`,
    ADDRESS: (addr: string) => `/explorer/address/${addr}`,
    STATE: (seq: number | string) => `/explorer/state/${seq}`,
    SEARCH: (q?: string) =>
      q ? `/explorer/search?q=${encodeURIComponent(q)}` : "/explorer/search",
  },
} as const;
