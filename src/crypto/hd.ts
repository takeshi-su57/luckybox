import { HDKey, hdKeyToAccount, type HDAccount } from "viem/accounts";

export const ETH_BIP44_BASE_PATH = "m/44'/60'/0'/0";
export type DerivationPath = `m/44'/60'/${string}`;

function assertValidIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid account index "${index}". Index must be a non-negative integer.`);
  }
}

export function getDerivationPath(index: number): DerivationPath {
  assertValidIndex(index);
  return `${ETH_BIP44_BASE_PATH}/${index}` as DerivationPath;
}

export function deriveAccount(seed: Uint8Array, index: number): HDAccount {
  assertValidIndex(index);
  const root = HDKey.fromMasterSeed(seed);
  return hdKeyToAccount(root, { path: getDerivationPath(index) });
}

export function deriveAddress(seed: Uint8Array, index: number): string {
  return deriveAccount(seed, index).address;
}
