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

export function deriveWallet(passphrase: string, walletSalt: string, index: number): BoxWallet {
  assertValidIndex(index);
  const seed = deriveSeed(passphrase, walletSalt);
  const account = deriveAccount(seed, index);

  return {
    box: indexToBox(index),
    index,
    path: getDerivationPath(index),
    address: account.address,
    account
  };
}

export function derivePrivateKey(_passphrase: string, _index: number): `0x${string}` {
  void _passphrase;
  void _index;
  throw new Error("derivePrivateKey() is deprecated; use derivePrivateKeyWithSalt().");
}

export function derivePrivateKeyWithSalt(
  passphrase: string,
  walletSalt: string,
  index: number
): `0x${string}` {
  assertValidIndex(index);
  const seed = deriveSeed(passphrase, walletSalt);
  const account = deriveAccount(seed, index);
  const hdKey = account.getHdKey();

  if (!hdKey.privateKey) {
    throw new Error("Failed to derive private key from HD account.");
  }

  return `0x${Buffer.from(hdKey.privateKey).toString("hex")}` as `0x${string}`;
}

export function deriveWalletByBox(_passphrase: string, _box: string): BoxWallet {
  void _passphrase;
  void _box;
  throw new Error("deriveWalletByBox() is deprecated; use deriveWalletByBoxWithSalt().");
}

export function deriveWalletByBoxWithSalt(
  passphrase: string,
  walletSalt: string,
  box: string
): BoxWallet {
  return deriveWallet(passphrase, walletSalt, boxToIndex(box));
}

export function derivePrivateKeyByBox(_passphrase: string, _box: string): `0x${string}` {
  void _passphrase;
  void _box;
  throw new Error("derivePrivateKeyByBox() is deprecated; use derivePrivateKeyByBoxWithSalt().");
}

export function derivePrivateKeyByBoxWithSalt(
  passphrase: string,
  walletSalt: string,
  box: string
): `0x${string}` {
  return derivePrivateKeyWithSalt(passphrase, walletSalt, boxToIndex(box));
}

export function deriveDefaultWallets(_passphrase: string): BoxWallet[] {
  void _passphrase;
  throw new Error("deriveDefaultWallets() is deprecated; use deriveDefaultWalletsWithSalt().");
}

export function deriveDefaultWalletsWithSalt(passphrase: string, walletSalt: string): BoxWallet[] {
  return [deriveWallet(passphrase, walletSalt, 0), deriveWallet(passphrase, walletSalt, 1)];
}
