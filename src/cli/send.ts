import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatGwei,
  getAddress,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
  type Chain
} from "viem";
import { getVaultConfig, resolveErc20Address } from "../config/env";
import { deriveWalletByBox, formatPartialAddress } from "../wallet/derive";
import { promptLine, readPassphrase, resolveRpcUrl } from "./shared";

type FeePreview = {
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

type PreparedTransfer = {
  displayAmount: string;
  previewTarget: Address;
  request: {
    data?: `0x${string}`;
    to: Address;
    value: bigint;
  };
};

async function getFeePreview(
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

function parseRecipientAddress(raw: string): Address {
  if (!isAddress(raw, { strict: false })) {
    throw new Error(`Invalid recipient address: ${raw}`);
  }
  return getAddress(raw);
}

async function prepareTransfer(
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

export async function runSendCommand(options: {
  box: string;
  to: string;
  amount: string;
  token?: string;
  passphrase?: string;
  rpcUrl?: string;
}): Promise<void> {
  if (!options.box) {
    throw new Error(
      "Missing wallet alias. Usage: vault send box1 --to <address> --amount <value> [--token <symbol|address>] [--rpc-url <url>]"
    );
  }
  if (!options.to) {
    throw new Error('Missing required option "--to".');
  }
  if (!options.amount) {
    throw new Error('Missing required option "--amount".');
  }

  const to = parseRecipientAddress(options.to);
  const amountInput = options.amount;
  const tokenSelector = options.token;
  const passphrase = await readPassphrase({ passphrase: options.passphrase });
  const wallet = deriveWalletByBox(passphrase, options.box);
  const config = getVaultConfig();
  const rpcUrl = resolveRpcUrl(options.rpcUrl);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(rpcUrl)
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== config.chainId) {
    throw new Error(
      `Connected chain ${chainId} does not match configured network "${config.network}" (${config.chainId}).`
    );
  }

  const preparedTransfer = await prepareTransfer(
    publicClient,
    amountInput,
    to,
    tokenSelector,
    config.nativeTokenSymbol
  );

  const [gasLimit, nonce, feePreview] = await Promise.all([
    publicClient.estimateGas({
      account: wallet.account.address,
      data: preparedTransfer.request.data,
      to: preparedTransfer.request.to,
      value: preparedTransfer.request.value
    }),
    publicClient.getTransactionCount({
      address: wallet.address,
      blockTag: "pending"
    }),
    getFeePreview(publicClient, config.chain)
  ]);

  console.log(`From: ${wallet.box} (${formatPartialAddress(wallet.address)})`);
  console.log(`To: ${preparedTransfer.previewTarget}`);
  console.log(`Amount: ${preparedTransfer.displayAmount}`);
  console.log(`Network: ${config.network}`);
  console.log(`Chain: ${chainId}`);
  console.log(`Preview Address: ${formatPartialAddress(wallet.address)}`);
  console.log(`Gas Limit: ${gasLimit.toString()}`);
  console.log(`Nonce: ${nonce}`);

  if (feePreview.maxFeePerGas !== undefined && feePreview.maxPriorityFeePerGas !== undefined) {
    console.log(`Max Fee: ${formatGwei(feePreview.maxFeePerGas)} gwei`);
    console.log(`Priority Fee: ${formatGwei(feePreview.maxPriorityFeePerGas)} gwei`);
  } else if (feePreview.gasPrice !== undefined) {
    console.log(`Gas Price: ${formatGwei(feePreview.gasPrice)} gwei`);
  }

  if (tokenSelector) {
    console.log(`Token Contract: ${preparedTransfer.request.to}`);
  }
  console.log("Warning: public transaction");

  const confirmation = (await promptLine('Type "send" to confirm: ')).trim().toLowerCase();
  if (confirmation !== "send") {
    console.log("Cancelled.");
    return;
  }

  const walletClient = createWalletClient({
    account: wallet.account,
    chain: config.chain,
    transport: http(rpcUrl)
  });

  let hash: `0x${string}`;
  if (feePreview.gasPrice !== undefined) {
    hash = await walletClient.sendTransaction({
      account: wallet.account,
      chain: config.chain,
      data: preparedTransfer.request.data,
      gas: gasLimit,
      gasPrice: feePreview.gasPrice,
      to: preparedTransfer.request.to,
      value: preparedTransfer.request.value
    });
  } else if (
    feePreview.maxFeePerGas !== undefined &&
    feePreview.maxPriorityFeePerGas !== undefined
  ) {
    hash = await walletClient.sendTransaction({
      account: wallet.account,
      chain: config.chain,
      data: preparedTransfer.request.data,
      gas: gasLimit,
      maxFeePerGas: feePreview.maxFeePerGas,
      maxPriorityFeePerGas: feePreview.maxPriorityFeePerGas,
      to: preparedTransfer.request.to,
      value: preparedTransfer.request.value
    });
  } else {
    throw new Error("Unable to resolve gas fee data for this network.");
  }

  console.log(`Sent: ${hash}`);
}
