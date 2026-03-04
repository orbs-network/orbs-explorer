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
  /** TWAP orders table tab: "old" = Old TWAP, omit or "all" = All, "new" = New TWAP */
  TWAP_TAB = "twap_tab",
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
    overview: `/twap/overview`,
  },
};


export const ELASTIC_ENDPOINT = "https://api.bi.orbs.network";
export const TWAP_ELASTIC_CLIENT_URL = `${ELASTIC_ENDPOINT}/orbs-twap-ui*`;
export const LIQUIDITY_HUB_ELASTIC_SERVER_URL = `${ELASTIC_ENDPOINT}/orbs-clob-poc10*`;
export const LIQUIDITY_HUB_ELASTIC_CLIENT_URL = `${ELASTIC_ENDPOINT}/orbs-liquidity-hub-ui*`;

export const DEFAULT_SESSIONS_TIME_RANGE = "30m";

export const TX_TRACE_SERVER = "https://utils.orbs.network/tx-trace";

/** Old TWAP (v1) subgraph endpoints - The Graph */
const THE_GRAPH_API =
  "https://hub.orbs.network/api/apikey/subgraphs/id";
const getGfURL = (name: string) =>
  `https://hub.orbs.network/api/private/project_cm7nb67z86nyr01z12gs0fxpf/subgraphs/orbs-twap-${name}/prod/gn`;

export const THE_GRAPH_ORDERS_API: Record<number, string> = {
  1: `${THE_GRAPH_API}/Bf7bvMYcJbDAvYWJmhMpHZ4cpFjqzkhK6GXXEpnPRq6`,
  56: `${THE_GRAPH_API}/4NfXEi8rreQsnAr4aJ45RLCKgnjcWX46Lbt9SadiCcz6`,
  137: `${THE_GRAPH_API}/3PyRPWSvDnMowGbeBy7aNsvUkD5ZuxdXQw2RdJq4NdXi`,
  42161: `${THE_GRAPH_API}/83bpQexEaqBjHaQbKoFTbtvCXuo5RudRkfLgtRUYqo2c`,
  8453: `${THE_GRAPH_API}/DFhaPQb3HATXkpsWNZw3gydYHehLBVEDiSk4iBdZJyps`,
  1329: `${THE_GRAPH_API}/5zjzRnURzoddyFSZBw5E5NAM3oBgPq3NasTYbtMk6EL6`,
  59144: `${THE_GRAPH_API}/6VsNPEYfFLPZCqdMMDadoXQjLHWJdjEwiD768GAtb7j6`,
  146: `${THE_GRAPH_API}/DtBr6a5vsoDd2oAXdPszcn4gLgrr1XC68Q3AJQKXnNLV`,
  250: `${THE_GRAPH_API}/DdRo1pmJkrJC9fjsjEBWnNE1uqrbh7Diz4tVKd7rfupp`,
  747474: `${THE_GRAPH_API}/CGi9sDFMQcnBwF3C3NoCFqnaE34sssbgwPLTwiskSXmW`,
  43114: `${THE_GRAPH_API}/FxZ1vMwE5Xy1qvKvZENUMz4vhW8Sh4vXJf9Vp7o17pTx`,
  80094: getGfURL("berachain"),
  14: getGfURL("flare"),
  388: getGfURL("cronos-zkevm"),
};

/**
 * Chains where PancakeSwap v1 TWAP exists (BSC, Arbitrum, Base, Linea).
 * Used to avoid unnecessary v1 API calls on other chains.
 */
export const PANCAKESWAP_V1_CHAIN_IDS: number[] = [56, 42161, 8453, 59144];

/**
 * PancakeSwap exchange addresses per chain for v1 TWAP filtering.
 * Current from twap configs.json + legacy from spot-ui LEGACY_EXCHANGES_MAP.
 * @see https://github.com/orbs-network/twap/blob/master/configs.json
 * @see https://github.com/orbs-network/spot-ui/blob/master/packages/spot-ui/src/lib/consts.ts (LEGACY_EXCHANGES_MAP)
 */
export const PANCAKESWAP_V1_EXCHANGE_ADDRESSES: Record<number, string[]> = {
  // BSC 56 – PancakeSwap
  56: [
    "0x1A2bb6B75D58b740d88413ef4840D6fa3F637940",
    // "0xb2BAFe188faD927240038cC4FfF2d771d8A58905",
    // "0xE2a0c3b9aD19A18c4bBa7fffBe5bC1b0E58Db1CE",
  ],
  // Arbitrum 42161 – PancakeSwapArbitrum
  42161: [
    // "0xb37cB9A058c03081Ae6EF934313588cD53d408e7",
    // "0xE20167871dB616DdfFD0Fd870d9bC068C350DD1F",
    // "0x807488ADAD033e95C438F998277bE654152594dc",
  ],
  // Base 8453 – PancakeSwapBase
  8453: [
    // "0xb37cB9A058c03081Ae6EF934313588cD53d408e7",
    // "0x10ed1F36e4eBE76E161c9AADDa20BE841bc0082c",
    // "0x3A9df3eE209b802D0337383f5abCe3204d623588",
  ],
  // Linea 59144 – PancakeSwapLinea
  59144: [
    // "0xb37cB9A058c03081Ae6EF934313588cD53d408e7",
    // "0x3A9df3eE209b802D0337383f5abCe3204d623588",
  ],
};

export const ORBS_LOGO =
  "https://raw.githubusercontent.com/orbs-network/twap-ui/master/logo/orbslogo.svg";

