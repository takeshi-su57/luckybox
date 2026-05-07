import type { Address } from "viem";

export type FeePreview = {
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

export type PreparedTransfer = {
  displayAmount: string;
  previewTarget: Address;
  request: {
    data?: `0x${string}`;
    to: Address;
    value: bigint;
  };
};
