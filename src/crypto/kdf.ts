import { scryptSync } from "node:crypto";
import { getVaultConfig } from "../config/env";

export const BRAIN_WALLET_SALT = "brainvault:v1:ethereum";

const SEED_SIZE = 32;
const SCRYPT_OPTIONS = {
  N: 1 << 15,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024
} as const;

export function normalizePassphrase(passphrase: string): string {
  if (typeof passphrase !== "string") {
    throw new TypeError("Passphrase must be a string.");
  }

  const normalized = passphrase.normalize("NFKD");
  if (normalized.length === 0) {
    throw new Error("Passphrase cannot be empty.");
  }

  return normalized;
}

export function deriveSeed(passphrase: string): Uint8Array {
  const normalized = normalizePassphrase(passphrase);
  const configuredSalt = getVaultConfig().kdfSalt;
  const seed = scryptSync(normalized, configuredSalt, SEED_SIZE, SCRYPT_OPTIONS);
  return new Uint8Array(seed);
}
