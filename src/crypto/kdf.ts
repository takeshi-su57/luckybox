import { scryptSync } from "node:crypto";
import { DEFAULT_KDF_SALT, getKdfSalt } from "../config/kdf";

export const BRAIN_WALLET_SALT = DEFAULT_KDF_SALT;

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
  const configuredSalt = getKdfSalt();
  const seed = scryptSync(normalized, configuredSalt, SEED_SIZE, SCRYPT_OPTIONS);
  return new Uint8Array(seed);
}
