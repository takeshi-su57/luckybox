import { createPublicClient, erc20Abi, formatEther, formatUnits, http, type Address } from "viem";
import { getVaultConfig, resolveErc20Address } from "../config/env";
import { deriveWalletByBox } from "../wallet/derive";
import { readPassphrase, resolveRpcUrl } from "./shared";

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
  rpcUrl?: string;
}): Promise<void> {
  if (!options.box) {
    throw new Error("Missing wallet alias. Usage: vault balance box1 [--rpc-url <url>]");
  }

  const passphrase = await readPassphrase({ passphrase: options.passphrase });
  const wallet = deriveWalletByBox(passphrase, options.box);
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
