export type ExplorerSearchKind =
  | "address"
  | "hash"
  | "integer"
  | "unknown"
  | "empty";

export type ExplorerSearchInput = {
  raw: string;
  trimmed: string;
  kind: ExplorerSearchKind;
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const INT_RE = /^\d+$/;

export function classifySearchInput(raw: string): ExplorerSearchInput {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { raw, trimmed, kind: "empty" };
  if (ADDRESS_RE.test(trimmed)) return { raw, trimmed, kind: "address" };
  if (HASH_RE.test(trimmed)) return { raw, trimmed, kind: "hash" };
  if (INT_RE.test(trimmed)) return { raw, trimmed, kind: "integer" };
  return { raw, trimmed, kind: "unknown" };
}
