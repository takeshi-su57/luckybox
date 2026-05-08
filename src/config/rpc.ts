import type { SupportedNetwork } from "./chains";

const DEFAULT_RPC_URLS: Record<SupportedNetwork, string> = {
  ethereum: "https://ethereum-rpc.publicnode.com",
  arbitrum: "https://arbitrum-one-rpc.publicnode.com",
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  base: "https://base-rpc.publicnode.com",
  polygon: "https://polygon-bor-rpc.publicnode.com"
};

export function resolveRpcUrl(rpcUrlOverride?: string, network?: SupportedNetwork): string {
  const normalizedOverride = rpcUrlOverride?.trim();
  if (normalizedOverride) return normalizedOverride;

  if (network) {
    return DEFAULT_RPC_URLS[network];
  }

  throw new Error("Missing RPC URL. Provide --rpc-url <url>.");
}
