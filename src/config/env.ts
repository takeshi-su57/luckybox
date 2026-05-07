import process from "node:process";
import { config as loadDotEnv } from "dotenv";
import { getAddress, isAddress, type Address, type Chain } from "viem";
import { getChainByNetwork, parseSupportedNetwork, type SupportedNetwork } from "./chains";

loadDotEnv({ quiet: true });

export const DEFAULT_KDF_SALT = "brainvault:v1:ethereum";
const DEFAULT_NATIVE_TOKEN = "ETH";

export type VaultConfig = {
  kdfSalt: string;
  network: SupportedNetwork;
  chain: Chain;
  chainId: number;
  nativeTokenSymbol: string;
  erc20Tokens: Record<string, Address>;
};

export function parseErc20TokenMap(raw: string | undefined): Record<string, Address> {
  if (!raw || raw.trim().length === 0) {
    return {};
  }

  const mapping: Record<string, Address> = {};
  const entries = raw.split(",");

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const [symbolRaw, addressRaw] = trimmed.split(":");
    if (!symbolRaw || !addressRaw) {
      throw new Error(
        "VAULT_ERC20_TOKENS entries must use SYMBOL:ADDRESS format separated by commas."
      );
    }

    const symbol = symbolRaw.trim().toUpperCase();
    const addressCandidate = addressRaw.trim();
    if (!isAddress(addressCandidate, { strict: false })) {
      throw new Error(`Invalid ERC20 address for ${symbol}: ${addressCandidate}`);
    }

    mapping[symbol] = getAddress(addressCandidate);
  }

  return mapping;
}

export function getVaultConfig(): VaultConfig {
  const kdfSalt = process.env.BRAIN_WALLET_SALT?.trim() || DEFAULT_KDF_SALT;
  const network = parseSupportedNetwork(process.env.VAULT_NETWORK);
  const chain = getChainByNetwork(network);
  const nativeTokenSymbol =
    process.env.VAULT_NATIVE_TOKEN?.trim() || chain.nativeCurrency.symbol || DEFAULT_NATIVE_TOKEN;
  const erc20Tokens = parseErc20TokenMap(process.env.VAULT_ERC20_TOKENS);

  return {
    kdfSalt,
    network,
    chain,
    chainId: chain.id,
    nativeTokenSymbol,
    erc20Tokens
  };
}

export function resolveErc20Address(symbolOrAddress: string): Address {
  const config = getVaultConfig();

  if (isAddress(symbolOrAddress, { strict: false })) {
    return getAddress(symbolOrAddress);
  }

  const symbol = symbolOrAddress.trim().toUpperCase();
  const configured = config.erc20Tokens[symbol];
  if (!configured) {
    throw new Error(
      `Token "${symbolOrAddress}" is not configured. Add it to VAULT_ERC20_TOKENS or pass a token address.`
    );
  }

  return configured;
}
