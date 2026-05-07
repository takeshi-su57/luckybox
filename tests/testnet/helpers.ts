import process from "node:process";

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

export function getNativeSendAmount(): string {
  return process.env.TEST_NATIVE_SEND_AMOUNT?.trim() || "0.000001";
}

export function getErc20SendAmount(): string {
  return process.env.TEST_ERC20_SEND_AMOUNT?.trim() || "0.01";
}
