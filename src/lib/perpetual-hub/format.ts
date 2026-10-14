export function formatPerpetualHubActionName(value?: string) {
  if (!value) return "-";

  const names: Record<string, string> = {
    OPEN_POSITION: "Position opened",
    CLOSE_POSITION: "Position closed",
    CREATE_LIMIT_ORDER: "Limit order placed",
    CREATE_STOP_ORDER: "Stop order placed",
    FILL_ORDER: "Order traded",
    CANCEL_ORDER: "Order cancelled",
    CHANGE_LEVERAGE: "Leverage changed",
    REGISTER_SESSION_KEY: "Trading permission added",
    DEPOSIT: "Deposit",
    WITHDRAW: "Withdrawal",
    FUNDING_RATE: "Funding adjustment",
    LIQUIDATION: "Position liquidated",
  };
  if (names[value.toUpperCase()]) return names[value.toUpperCase()];
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getPerpetualHubMarketSymbols(value?: string) {
  if (!value) return [];

  const trimmed = value.trim();
  const bracketMatch = trimmed.match(/^\[(.*)\]$/);
  const normalized = bracketMatch ? bracketMatch[1] : trimmed;

  return normalized
    .split(/[,\s]+/)
    .map((symbol) => symbol.trim())
    .filter(Boolean);
}

export function formatPerpetualHubMarket(value?: string) {
  const symbols = getPerpetualHubMarketSymbols(value);
  return symbols.length ? symbols.join(", ") : "-";
}

export function formatPerpetualHubStatus(value?: string) {
  if (!value) return "Not reported";
  const labels: Record<string, string> = {
    SUCCESS: "Account updated",
    REJECTED: "Rejected",
    CONFIRMED: "Confirmed",
    SUBMITTED: "Sent to blockchain",
    PENDING: "Waiting",
    FAILED: "Unsuccessful",
  };
  return labels[value.toUpperCase()] || value;
}
