import process from "node:process";

export const DEFAULT_KDF_SALT = "brainvault:v1:ethereum";

export function getKdfSalt(): string {
  const rawSalt = process.env.BRAIN_WALLET_SALT;
  if (rawSalt === undefined) {
    return DEFAULT_KDF_SALT;
  }

  const normalized = rawSalt.trim();
  if (normalized.length === 0) {
    throw new Error("Invalid BRAIN_WALLET_SALT: value cannot be blank.");
  }

  return normalized;
}
