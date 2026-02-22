export const MOBILE = 768;

export enum URL_QUERY_KEYS {
  USER = "user",
  HASH = "hash",
  TWAP_ADDRESS = "twap_address",
  IN_TOKEN = "in_token",
  OUT_TOKEN = "out_token",
  CHAIN_ID = "chain_id",
  MIN_DOLLAR_VALUE = "min_dollar_value",
  PARTNER_ID = "partner_id",
  ORDER_STATUS = "order_status",
  FEE_OUT_AMOUNT_USD = "fee_out_amount_usd",
  TIMESTAMP = "timestamp",
  ORDER_TYPE = "order_type",
  SESSION_ID = "session_id",
  STATUS = "status",
  TWAP_SINK_ENV = "twap_sink_env",
}

export const FILTER_KEY_NAMES = {
  [URL_QUERY_KEYS.TIMESTAMP]: "Timestamp",
  [URL_QUERY_KEYS.HASH]: "Hash",
  [URL_QUERY_KEYS.USER]: "User",
  [URL_QUERY_KEYS.CHAIN_ID]: "Chain ID",
  [URL_QUERY_KEYS.TWAP_ADDRESS]: "Twap Address",
  [URL_QUERY_KEYS.IN_TOKEN]: "In Token",
  [URL_QUERY_KEYS.OUT_TOKEN]: "Out Token",
  [URL_QUERY_KEYS.FEE_OUT_AMOUNT_USD]: "Fee Out Amount USD",
  [URL_QUERY_KEYS.ORDER_STATUS]: "Order Status",
  [URL_QUERY_KEYS.MIN_DOLLAR_VALUE]: "Min Dollar Value",
  [URL_QUERY_KEYS.PARTNER_ID]: "Partner",
  [URL_QUERY_KEYS.ORDER_TYPE]: "Order Type",
  [URL_QUERY_KEYS.SESSION_ID]: "Session ID",
  [URL_QUERY_KEYS.STATUS]: "Status",
};

export const REACT_QUERY_KEYS = {
  spotConfig: "spotConfig",
  spotPaginatedOrders: "spotPaginatedOrders",
  spotOrder: "spotOrder",
  spotOrders: "spotOrders",
  configs: "configs",
  orderClientLogs: "orderClientLogs",
};

export const ROUTES = {
  root: "/",
  liquidityHub: {
    root: "/liquidity-hub",
    swap: `/liquidity-hub/swap/:identifier`,
    swapPreview: `/liquidity-hub/swap-preview/:identifier`,
    overview: `/liquidity-hub/overview`,
  },
  twap: {
    root: `/twap`,
    orders: `/twap/orders`,
    order: `/twap/order`,
    overview: `/orders-dashboard`,
  },
};


export const ELASTIC_ENDPOINT = "https://api.bi.orbs.network";
export const TWAP_ELASTIC_CLIENT_URL = `${ELASTIC_ENDPOINT}/orbs-twap-ui*`;
export const LIQUIDITY_HUB_ELASTIC_SERVER_URL = `${ELASTIC_ENDPOINT}/orbs-clob-poc10*`;
export const LIQUIDITY_HUB_ELASTIC_CLIENT_URL = `${ELASTIC_ENDPOINT}/orbs-liquidity-hub-ui*`;

export const DEFAULT_SESSIONS_TIME_RANGE = "30m";

export const TX_TRACE_SERVER = "https://utils.orbs.network/tx-trace";


export const ORBS_LOGO =
  "https://raw.githubusercontent.com/orbs-network/twap-ui/master/logo/orbslogo.svg";

