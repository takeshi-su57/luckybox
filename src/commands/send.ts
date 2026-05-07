import { Args, Command, Flags } from "@oclif/core";
import { createPublicClient, formatGwei, http } from "viem";
import { getVaultConfig } from "../config/env";
import { resolveRpcUrl } from "../config/rpc";
import { promptLine, readPassphrase } from "../io/prompt";
import { deriveWalletByBox, formatPartialAddress } from "../wallet/derive";
import { broadcastTransfer } from "../wallet/tx/broadcast";
import { getFeePreview } from "../wallet/tx/fee-strategy";
import { parseRecipientAddress, prepareTransfer } from "../wallet/tx/prepare-transfer";

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
  const normalizedAmount = options.amount.trim();
  if (normalizedAmount.length === 0) {
    throw new Error('Invalid amount: "--amount" cannot be blank.');
  }
  if (!Number.isFinite(Number(normalizedAmount)) || Number(normalizedAmount) <= 0) {
    throw new Error('Invalid amount: "--amount" must be a positive number.');
  }

  const to = parseRecipientAddress(options.to);
  const amountInput = normalizedAmount;
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

  const hash = await broadcastTransfer({
    account: wallet.account,
    chain: config.chain,
    rpcUrl,
    gasLimit,
    feePreview,
    preparedTransfer
  });

  console.log(`Sent: ${hash}`);
}

export default class Send extends Command {
  static override summary = "Send native token or ERC20 from a derived alias.";

  static override args = {
    box: Args.string({
      required: true,
      description: "Address alias (box1, box2, ...)."
    })
  };

  static override flags = {
    amount: Flags.string({
      required: true,
      description: "Amount to send."
    }),
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    }),
    "rpc-url": Flags.string({
      description: "RPC endpoint (or use ETH_RPC_URL env var)."
    }),
    to: Flags.string({
      required: true,
      description: "Recipient address."
    }),
    token: Flags.string({
      description: "ERC20 symbol from env or token contract address."
    })
  };

  public override async run(): Promise<void> {
    const { args, flags } = await this.parse(Send);
    await runSendCommand({
      amount: flags.amount,
      box: args.box,
      passphrase: flags.passphrase,
      rpcUrl: flags["rpc-url"],
      to: flags.to,
      token: flags.token
    });
  }
}
