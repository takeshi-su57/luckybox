import { createWalletClient, http, type Chain, type HDAccount } from "viem";
import type { FeePreview, PreparedTransfer } from "./types";

export async function broadcastTransfer(options: {
  account: HDAccount;
  chain: Chain;
  rpcUrl: string;
  gasLimit: bigint;
  feePreview: FeePreview;
  preparedTransfer: PreparedTransfer;
}): Promise<`0x${string}`> {
  const { account, chain, rpcUrl, gasLimit, feePreview, preparedTransfer } = options;
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl)
  });

  if (feePreview.gasPrice !== undefined) {
    return await walletClient.sendTransaction({
      account,
      chain,
      data: preparedTransfer.request.data,
      gas: gasLimit,
      gasPrice: feePreview.gasPrice,
      to: preparedTransfer.request.to,
      value: preparedTransfer.request.value
    });
  }

  if (feePreview.maxFeePerGas !== undefined && feePreview.maxPriorityFeePerGas !== undefined) {
    return await walletClient.sendTransaction({
      account,
      chain,
      data: preparedTransfer.request.data,
      gas: gasLimit,
      maxFeePerGas: feePreview.maxFeePerGas,
      maxPriorityFeePerGas: feePreview.maxPriorityFeePerGas,
      to: preparedTransfer.request.to,
      value: preparedTransfer.request.value
    });
  }

  throw new Error("Unable to resolve gas fee data for this network.");
}
