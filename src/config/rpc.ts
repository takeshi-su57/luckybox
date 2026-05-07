import process from "node:process";

export function resolveRpcUrl(rpcUrlOverride?: string): string {
  const rpcUrl = rpcUrlOverride ?? process.env.ETH_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "Missing RPC URL. Provide --rpc-url <url> or set ETH_RPC_URL in your environment."
    );
  }
  return rpcUrl;
}
