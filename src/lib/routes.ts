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
    STATE: (seq: number | string) => `/perpetual-hub/state/${seq}`,
    ROLLUP: (id: number | string) => `/perpetual-hub/rollup/${id}`,
    USER: (address: string) => `/perpetual-hub/user/${address}`,
  },
  ORDERS_DASHBOARD: "/twap/overview",
  LIQUIDITY_HUB_DASHBOARD: "/liquidity-hub-dashboard",
} as const;
