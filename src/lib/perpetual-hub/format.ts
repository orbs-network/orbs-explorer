export function formatPerpetualHubActionName(value?: string) {
  if (!value) return "-";

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
