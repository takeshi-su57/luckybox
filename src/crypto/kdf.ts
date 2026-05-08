import { scryptSync } from "node:crypto";

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

export function deriveSeed(passphrase: string, walletSalt: string): Uint8Array {
  const normalized = normalizePassphrase(passphrase);
  if (typeof walletSalt !== "string") {
    throw new TypeError("Wallet salt must be a string.");
  }
  const trimmedSalt = walletSalt.trim();
  if (trimmedSalt.length === 0) {
    throw new Error("Wallet salt cannot be blank.");
  }
  const seed = scryptSync(normalized, trimmedSalt, SEED_SIZE, SCRYPT_OPTIONS);
  return new Uint8Array(seed);
}
