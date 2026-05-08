import { Args, Command, Flags } from "@oclif/core";
import { createPublicClient, erc20Abi, formatEther, formatUnits, http, type Address } from "viem";
import { resolveRpcUrl } from "../config/rpc";
import { getVaultConfig, resolveErc20Address } from "../config/env";
import { resolvePassphrase } from "../io/passphrase";
import { deriveWalletByBoxWithSalt } from "../wallet/derive";
import { resolveWalletSalt } from "../config/wallet-salt";
import { promptLine } from "../io/prompt";

async function readErc20Balance(
  publicClient: ReturnType<typeof createPublicClient>,
  tokenAddress: Address,
  walletAddress: Address
): Promise<{ symbol: string; amount: string }> {
  const [symbol, decimals, rawBalance] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "symbol"
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals"
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress]
    })
  ]);

  return {
    symbol,
    amount: formatUnits(rawBalance, decimals)
  };
}

export async function runBalanceCommand(options: {
  box: string;
  token?: string;
  passphrase?: string;
  allowUnsafePassphrase?: boolean;
  passphraseStdin?: boolean;
  passphraseFile?: string;
  quiet?: boolean;
  rpcUrl?: string;
}): Promise<void> {
  if (!options.box) {
    throw new Error("Missing wallet alias. Usage: luckybox balance box1 [--rpc-url <url>]");
  }

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
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(resolveRpcUrl(options.rpcUrl))
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== config.chainId) {
    throw new Error(
      `Connected chain ${chainId} does not match configured network "${config.network}" (${config.chainId}).`
    );
  }

  console.log(`${wallet.box}: ${wallet.address}`);
  console.log(`Network: ${config.network}`);
  console.log(`Chain: ${chainId}`);

  const tokenSelector = options.token;
  if (tokenSelector) {
    const tokenAddress = resolveErc20Address(tokenSelector);
    const erc20 = await readErc20Balance(publicClient, tokenAddress, wallet.address as Address);
    console.log(`Balance: ${erc20.amount} ${erc20.symbol}`);
    console.log(`Token: ${tokenAddress}`);
    return;
  }

  const balance = await publicClient.getBalance({ address: wallet.address as Address });
  console.log(`Balance: ${formatEther(balance)} ${config.nativeTokenSymbol}`);
}

export default class Balance extends Command {
  static override summary = "Fetch native or ERC20 balance for an address alias.";

  static override args = {
    box: Args.string({
      required: true,
      description: "Address alias (box1, box2, ...)."
    })
  };

  static override flags = {
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
    token: Flags.string({
      description: "ERC20 symbol from env or token contract address."
    })
  };

  public override async run(): Promise<void> {
    const { args, flags } = await this.parse(Balance);
    await runBalanceCommand({
      box: args.box,
      allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
      passphrase: flags.passphrase,
      passphraseFile: flags["passphrase-file"],
      passphraseStdin: flags["passphrase-stdin"],
      quiet: flags.quiet,
      rpcUrl: flags["rpc-url"],
      token: flags.token
    });
  }
}
