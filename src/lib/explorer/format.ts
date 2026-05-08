export function formatInteger(value: number | string | undefined): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

export function formatUsdCompact(value: number | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatUsdShort(value: number | string | undefined): string {
  if (value === undefined || value === null) return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return formatUsdCompact(n);
}

export function formatNumber(
  value: number | string | undefined,
  fractionDigits = 4
): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}

export function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return "—";
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return (
    new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC"
  );
}

/** L1 explorer URL for the perp hub's settlement chain (Arbitrum One). */
export function arbiscanTxUrl(txHash: string): string {
  return `https://arbiscan.io/tx/${txHash}`;
}

export function arbiscanBlockUrl(blockNumber: number | string): string {
  return `https://arbiscan.io/block/${blockNumber}`;
}
