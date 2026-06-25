import { formatDecimals } from "@/lib/utils/utils";

function groupThousands(value: string) {
  const sign = value.startsWith("-") ? "-" : "";
  const unsigned = sign ? value.slice(1) : value;
  const [integer, decimal] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${decimal ? `.${decimal}` : ""}`;
}

function formatDecimalNumber(value: number, fractionDigits: number) {
  return groupThousands(formatDecimals(String(value), fractionDigits) || "0");
}

export function formatInteger(value: number | string | undefined): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatDecimalNumber(n, 0);
}

export function formatUsdCompact(value: number | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value))
    return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${formatDecimalNumber(value / 1e9, 2)}B`;
  if (abs >= 1e6) return `$${formatDecimalNumber(value / 1e6, 2)}M`;
  if (abs >= 1e3) return `$${formatDecimalNumber(value / 1e3, 2)}K`;
  return `$${formatDecimalNumber(value, 2)}`;
}

export function formatUsdShort(value: number | string | undefined): string {
  if (value === undefined || value === null) return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return "";
  return formatUsdCompact(n);
}

export function formatNumber(
  value: number | string | undefined,
  fractionDigits = 4,
): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatDecimalNumber(n, fractionDigits);
}

export function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) return "—";
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

/** L1 explorer URL for the perp hub's settlement chain (Arbitrum One). */
export function arbiscanTxUrl(txHash: string): string {
  return `https://arbiscan.io/tx/${txHash}`;
}

export function arbiscanBlockUrl(blockNumber: number | string): string {
  return `https://arbiscan.io/block/${blockNumber}`;
}
