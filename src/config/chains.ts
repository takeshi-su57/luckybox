import type { Chain } from "viem";
import { arbitrum, base, mainnet, polygon, sepolia } from "viem/chains";

export const SUPPORTED_NETWORKS = ["ethereum", "arbitrum", "sepolia", "base", "polygon"] as const;

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

const NETWORK_TO_CHAIN: Record<SupportedNetwork, Chain> = {
  ethereum: mainnet,
  arbitrum,
  sepolia,
  base,
  polygon
};

export function parseSupportedNetwork(raw: string | undefined): SupportedNetwork {
  const normalized = (raw?.trim().toLowerCase() || "ethereum") as string;

  if (normalized in NETWORK_TO_CHAIN) {
    return normalized as SupportedNetwork;
  }

  throw new Error(
    `Unsupported VAULT_NETWORK "${raw}". Supported networks: ${SUPPORTED_NETWORKS.join(", ")}.`
  );
}

export function getChainByNetwork(network: SupportedNetwork): Chain {
  return NETWORK_TO_CHAIN[network];
}
