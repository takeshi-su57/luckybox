import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
  type Address
} from "viem";
import { resolveErc20Address } from "../../config/env";
import type { PreparedTransfer } from "./types";

export function parseRecipientAddress(raw: string): Address {
  if (!isAddress(raw, { strict: false })) {
    throw new Error(`Invalid recipient address: ${raw}`);
  }
  return getAddress(raw);
}

export async function prepareTransfer(
  publicClient: ReturnType<typeof createPublicClient>,
  amountInput: string,
  recipient: Address,
  tokenSelector: string | undefined,
  nativeTokenSymbol: string
): Promise<PreparedTransfer> {
  if (!tokenSelector) {
    return {
      displayAmount: `${amountInput} ${nativeTokenSymbol}`,
      previewTarget: recipient,
      request: {
        to: recipient,
        value: parseEther(amountInput)
      }
    };
  }

  const tokenAddress = resolveErc20Address(tokenSelector);
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "symbol"
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals"
    })
  ]);

  const amount = parseUnits(amountInput, decimals);
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, amount]
  });

  return {
    displayAmount: `${amountInput} ${symbol}`,
    previewTarget: recipient,
    request: {
      data,
      to: tokenAddress,
      value: 0n
    }
  };
}
