import { createPublicClient, type Chain } from "viem";
import type { FeePreview } from "./types";

export async function getFeePreview(
  publicClient: ReturnType<typeof createPublicClient>,
  chain: Chain
): Promise<FeePreview> {
  try {
    const feeEstimate = await publicClient.estimateFeesPerGas({ chain, type: "eip1559" });
    return {
      maxFeePerGas: feeEstimate.maxFeePerGas,
      maxPriorityFeePerGas: feeEstimate.maxPriorityFeePerGas
    };
  } catch {
    const feeEstimate = await publicClient.estimateFeesPerGas({ chain, type: "legacy" });
    return { gasPrice: feeEstimate.gasPrice };
  }
}
