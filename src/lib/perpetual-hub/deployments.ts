export type PerpetualHubDeployment = {
  partnerId: string;
  partnerName: string;
  chainId: number;
  chainName: string;
  backendUrl: string;
  contractAddress: string;
};

const DEFAULT_BACKEND_URL =
  process.env.PERPETUAL_HUB_API_URL ||
  process.env.NEXT_PUBLIC_PERPETUAL_HUB_API_URL ||
  "https://perpsapi.orbs.network";

export const PERPETUAL_HUB_DEPLOYMENTS: PerpetualHubDeployment[] = [
  {
    partnerId: "playground",
    partnerName: "Perpetual Hub",
    chainId: 42161,
    chainName: "Arbitrum",
    backendUrl: DEFAULT_BACKEND_URL,
    contractAddress: "0x45446ce74d6f3902ec37fef2f38b046e327bf1c2",
  },
  {
    partnerId: "thena",
    partnerName: "THENA",
    chainId: 42161,
    chainName: "Arbitrum",
    backendUrl: DEFAULT_BACKEND_URL,
    contractAddress: "0x45446ce74d6f3902ec37fef2f38b046e327bf1c2",
  },
  {
    partnerId: "quickswap",
    partnerName: "QuickSwap",
    chainId: 137,
    chainName: "Polygon",
    backendUrl: "https://perpsapi.pol.orbs.network",
    contractAddress: "0xc206b7725e6e6631516b4fea100f8a07bbc736ee",
  },
];

export const PERPETUAL_HUB_PARTNER_OPTIONS = [
  { label: "Perpetual Hub", value: "playground" },
  { label: "THENA", value: "thena" },
  { label: "QuickSwap", value: "quickswap" },
];

export const PERPETUAL_HUB_CHAIN_OPTIONS = [
  { label: "Arbitrum", value: "42161" },
  { label: "Polygon", value: "137" },
];

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.find(Boolean);
  return value || undefined;
}

function values(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function uniqueByBackendAndChain(deployments: PerpetualHubDeployment[]) {
  const seen = new Set<string>();
  return deployments.filter((deployment) => {
    const key = `${deployment.backendUrl}:${deployment.chainId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolvePerpetualHubDeployments(filters: {
  partnerId?: string | string[];
  chainId?: string | string[];
  contract?: string | string[];
}) {
  const partnerId = firstValue(filters.partnerId)?.toLowerCase();
  const chainIds = values(filters.chainId);
  const contract = firstValue(filters.contract)?.toLowerCase();

  let deployments = PERPETUAL_HUB_DEPLOYMENTS;

  if (partnerId) {
    deployments = deployments.filter(
      (deployment) => deployment.partnerId === partnerId,
    );
  } else {
    deployments = uniqueByBackendAndChain(deployments);
  }

  if (chainIds.length) {
    deployments = deployments.filter((deployment) =>
      chainIds.includes(String(deployment.chainId)),
    );
  }

  if (contract) {
    deployments = deployments.filter((deployment) =>
      deployment.contractAddress.toLowerCase().includes(contract),
    );
  }

  return deployments;
}
