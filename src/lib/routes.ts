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
  ORDERS_DASHBOARD: "/orders-dashboard",
} as const;
