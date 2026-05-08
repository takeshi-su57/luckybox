import process from "node:process";
import { isAddress } from "viem";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function getTestTokenSymbol(): string {
  return process.env.TEST_TOKEN_SYMBOL?.trim() || "USDT";
}

export function hasConfiguredTokenSymbol(
  tokenSymbol: string,
  tokenMap: string | undefined = process.env.VAULT_ERC20_TOKENS
): boolean {
  const symbol = tokenSymbol.trim().toUpperCase();
  if (!symbol || !tokenMap?.trim()) return false;

  return tokenMap.split(",").some((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return false;
    const parts = trimmed.split(":");
    if (parts.length !== 2) return false;
    const [entrySymbol, entryAddress] = parts;
    if (!entrySymbol || !entryAddress) return false;
    if (entrySymbol.trim().toUpperCase() !== symbol) return false;
    return isAddress(entryAddress.trim(), { strict: false });
  });
}

export function getNativeSendAmount(): string {
  return process.env.TEST_NATIVE_SEND_AMOUNT?.trim() || "0.000001";
}

export function getErc20SendAmount(): string {
  return process.env.TEST_ERC20_SEND_AMOUNT?.trim() || "0.01";
}
