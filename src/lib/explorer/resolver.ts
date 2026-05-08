import { classifySearchInput } from "./search";
import type {
  PerpetualHubRollup,
  PerpetualHubSummary,
} from "@/lib/perpetual-hub/types";

export type Resolution =
  | {
      kind: "redirect";
      target: string;
      via:
        | "address"
        | "state_root"
        | "anchor_tx"
        | "op_state_root"
        | "integer_default_sequence";
    }
  | { kind: "not_found"; reason: string; query: string }
  | { kind: "empty" };

/**
 * Resolves a free-form search query to a target route.
 *
 * Inputs handled:
 *  - 0x + 40 hex   → /explorer/address/<addr>
 *  - 0x + 64 hex   → tries (in order):
 *      1) state root via /api/perpetual-hub/rollup-root  →  /explorer/block/<newSequence>
 *      2) L1 anchor tx in summary.rollups.latest         →  /explorer/batch/<id>
 *      3) op stateRoot in summary.activity.recentEvents  →  /explorer/block/<teeSequence>
 *  - integer       → /explorer/block/<n>  (sequences are the dominant entity)
 *
 * `origin` is the HTTP origin the resolver should use to call our own Next API
 * routes (server-to-server fetch needs an absolute URL).
 */
export async function resolveSearch(
  q: string,
  origin: string
): Promise<Resolution> {
  const input = classifySearchInput(q);

  if (input.kind === "empty") return { kind: "empty" };

  if (input.kind === "address") {
    return {
      kind: "redirect",
      target: `/explorer/address/${input.trimmed}`,
      via: "address",
    };
  }

  if (input.kind === "integer") {
    return {
      kind: "redirect",
      target: `/explorer/block/${input.trimmed}`,
      via: "integer_default_sequence",
    };
  }

  if (input.kind === "hash") {
    const lower = input.trimmed.toLowerCase();

    // 1) Try as a settled state root (matches some rollup's newStateRoot).
    try {
      const r = await fetch(
        `${origin}/api/perpetual-hub/rollup-root/${input.trimmed}`,
        { cache: "no-store", signal: AbortSignal.timeout(15_000) }
      );
      if (r.ok) {
        const data = (await r.json()) as { rollup?: PerpetualHubRollup };
        const rollup = data.rollup;
        if (rollup && typeof rollup.newSequence === "number") {
          return {
            kind: "redirect",
            target: `/explorer/block/${rollup.newSequence}`,
            via: "state_root",
          };
        }
      }
    } catch {
      /* fall through to next strategy */
    }

    // 2 & 3) Pull a snapshot of the recent window and look for tx-hash or
    // op-stateRoot matches.
    try {
      const r = await fetch(`${origin}/api/perpetual-hub/summary`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (r.ok) {
        const summary = (await r.json()) as PerpetualHubSummary;

        const batch = summary.rollups.latest.find(
          (b) => b.txHash?.toLowerCase() === lower
        );
        if (batch) {
          return {
            kind: "redirect",
            target: `/explorer/batch/${batch.id}`,
            via: "anchor_tx",
          };
        }

        const op = summary.activity.recentEvents.find(
          (o) => o.stateRoot?.toLowerCase() === lower
        );
        if (op && typeof op.teeSequence === "number") {
          return {
            kind: "redirect",
            target: `/explorer/block/${op.teeSequence}`,
            via: "op_state_root",
          };
        }
      }
    } catch {
      /* fall through */
    }

    return {
      kind: "not_found",
      reason:
        "Hash didn't match any settled state root, recent L1 anchor tx, or recent op state root in the visible window.",
      query: input.trimmed,
    };
  }

  return {
    kind: "not_found",
    reason:
      "Input doesn't match address (0x + 40 hex), hash (0x + 64 hex), or sequence (integer).",
    query: input.trimmed,
  };
}
