import { Args, Command, Flags } from "@oclif/core";
import { createPublicClient, formatGwei, http } from "viem";
import { getVaultConfig } from "../config/env";
import { resolveRpcUrl } from "../config/rpc";
import { promptLine } from "../io/prompt";
import { resolvePassphrase } from "../io/passphrase";
import { deriveWalletByBoxWithSalt, formatPartialAddress } from "../wallet/derive";
import { resolveWalletSalt } from "../config/wallet-salt";
import { broadcastTransfer } from "../wallet/tx/broadcast";
import { getFeePreview } from "../wallet/tx/fee-strategy";
import { parseRecipientAddress, prepareTransfer } from "../wallet/tx/prepare-transfer";

export async function runSendCommand(options: {
  box: string;
  to: string;
  amount: string;
  token?: string;
  passphrase?: string;
  allowUnsafePassphrase?: boolean;
  passphraseStdin?: boolean;
  passphraseFile?: string;
  quiet?: boolean;
  rpcUrl?: string;
}): Promise<void> {
  if (!options.box) {
    throw new Error(
      "Missing wallet alias. Usage: luckybox send box1 --to <address> --amount <value> [--token <symbol|address>] [--rpc-url <url>]"
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
  const passphrase = (
    await resolvePassphrase({
      passphraseArg: options.passphrase,
      allowUnsafePassphrase: options.allowUnsafePassphrase,
      passphraseStdin: options.passphraseStdin,
      passphraseFile: options.passphraseFile,
      quiet: options.quiet
    })
  ).passphrase;
  const { salt } = await resolveWalletSalt({ prompt: promptLine });
  const wallet = deriveWalletByBoxWithSalt(passphrase, salt, options.box);
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
    "passphrase-stdin": Flags.boolean({
      description: "Read passphrase from stdin (recommended for automation/tests)."
    }),
    "passphrase-file": Flags.string({
      description: "Read passphrase from file (recommended for automation/tests)."
    }),
    "allow-unsafe-passphrase": Flags.boolean({
      description: "Allow unsafe passphrase sources (env/--passphrase). Intended for tests."
    }),
    passphrase: Flags.string({
      description: "UNSAFE: passphrase via CLI arg (requires --allow-unsafe-passphrase)."
    }),
    quiet: Flags.boolean({
      description: "Suppress warnings."
    }),
    "rpc-url": Flags.string({
      description: "RPC endpoint."
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
      allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
      box: args.box,
      passphrase: flags.passphrase,
      passphraseFile: flags["passphrase-file"],
      passphraseStdin: flags["passphrase-stdin"],
      quiet: flags.quiet,
      rpcUrl: flags["rpc-url"],
      to: flags.to,
      token: flags.token
    });
  }
}
