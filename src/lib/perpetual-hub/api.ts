import type {
  PerpetualHubRollupDetail,
  PerpetualHubRollup,
  PerpetualHubStateDetail,
  PerpetualHubSummary,
  PerpetualHubUserDetail,
} from "./types";

export async function getPerpetualHubSummary(
  signal?: AbortSignal
): Promise<PerpetualHubSummary> {
  const response = await fetch("/api/perpetual-hub/summary", { signal });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub summary (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubState(
  seq: string | number,
  signal?: AbortSignal
): Promise<PerpetualHubStateDetail> {
  const response = await fetch(`/api/perpetual-hub/state/${seq}`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub state (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubRollup(
  id: string | number,
  signal?: AbortSignal
): Promise<PerpetualHubRollupDetail> {
  const response = await fetch(`/api/perpetual-hub/rollup/${id}`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub rollup (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubUser(
  address: string,
  signal?: AbortSignal
): Promise<PerpetualHubUserDetail> {
  const response = await fetch(`/api/perpetual-hub/user/${address}`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load Perpetual Hub user (${response.status})`);
  }
  return response.json();
}

export async function getPerpetualHubRollupByRoot(
  root: string,
  signal?: AbortSignal
): Promise<{ rollup: PerpetualHubRollup }> {
  const response = await fetch(`/api/perpetual-hub/rollup-root/${root}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to find rollup root (${response.status})`);
  }
  return response.json();
}
