import { deriveSeed } from "../crypto/kdf";
import { deriveAccount, getDerivationPath } from "../crypto/hd";
import type { HDAccount } from "viem/accounts";
import type { Address } from "viem";

const BOX_ALIAS_PATTERN = /^box([1-9]\d*)$/i;

export type BoxWallet = {
  box: string;
  index: number;
  path: string;
  address: Address;
  privateKey: `0x${string}`;
  account: HDAccount;
};

function assertValidIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid wallet index "${index}".`);
  }
}

export function indexToBox(index: number): string {
  assertValidIndex(index);
  return `box${index + 1}`;
}

export function boxToIndex(box: string): number {
  const match = BOX_ALIAS_PATTERN.exec(box);
  if (!match) {
    throw new Error(`Invalid wallet alias "${box}". Use the format box1, box2, ...`);
  }

  const parsed = Number.parseInt(match[1]!, 10);
  return parsed - 1;
}

export function formatPartialAddress(address: Address | string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}

export function deriveWallet(passphrase: string, index: number): BoxWallet {
  assertValidIndex(index);
  const seed = deriveSeed(passphrase);
  const account = deriveAccount(seed, index);
  const hdKey = account.getHdKey();

  if (!hdKey.privateKey) {
    throw new Error("Failed to derive private key from HD account.");
  }

  const privateKey = `0x${Buffer.from(hdKey.privateKey).toString("hex")}` as `0x${string}`;

  return {
    box: indexToBox(index),
    index,
    path: getDerivationPath(index),
    address: account.address,
    privateKey,
    account
  };
}

export function deriveWalletByBox(passphrase: string, box: string): BoxWallet {
  return deriveWallet(passphrase, boxToIndex(box));
}

export function deriveDefaultWallets(passphrase: string): BoxWallet[] {
  return [deriveWallet(passphrase, 0), deriveWallet(passphrase, 1)];
}
