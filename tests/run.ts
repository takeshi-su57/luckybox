import assert from "node:assert/strict";
import process from "node:process";
import {
  DEFAULT_KDF_SALT,
  getVaultConfig,
  parseErc20TokenMap,
  resolveErc20Address
} from "../src/config/env";
import { SUPPORTED_NETWORKS } from "../src/config/chains";
import { runAddressCommand } from "../src/cli/address";
import { runBalanceCommand } from "../src/cli/balance";
import { runSendCommand } from "../src/cli/send";
import { deriveSeed } from "../src/crypto/kdf";
import { deriveAddress, getDerivationPath } from "../src/crypto/hd";
import {
  deriveWallet,
  boxToIndex,
  deriveDefaultWallets,
  deriveWalletByBox,
  formatPartialAddress,
  indexToBox
} from "../src/wallet/derive";
import { KEY_STANDARD_METHOD, KEY_STANDARD_NAME } from "../src/wallet/standard";

type Case = {
  name: string;
  run: () => Promise<void> | void;
};

const ORIGINAL_ENV = { ...process.env };
const cases: Case[] = [];

function test(name: string, run: () => Promise<void> | void): void {
  cases.push({ name, run });
}

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function toHex(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

test("parseErc20TokenMap parses symbol:address pairs", () => {
  const map = parseErc20TokenMap(
    "USDC:0x0000000000000000000000000000000000000001,DAI:0x0000000000000000000000000000000000000002"
  );
  assert.equal(map.USDC, "0x0000000000000000000000000000000000000001");
  assert.equal(map.DAI, "0x0000000000000000000000000000000000000002");
});

test("getVaultConfig applies defaults", () => {
  delete process.env.BRAIN_WALLET_SALT;
  delete process.env.VAULT_NETWORK;
  delete process.env.VAULT_NATIVE_TOKEN;
  delete process.env.VAULT_ERC20_TOKENS;

  const config = getVaultConfig();
  assert.equal(config.kdfSalt, DEFAULT_KDF_SALT);
  assert.equal(config.network, "ethereum");
  assert.equal(config.chainId, 1);
  assert.equal(config.nativeTokenSymbol, "ETH");
  assert.deepEqual(config.erc20Tokens, {});
});

test("getVaultConfig reads supported network and native token overrides", () => {
  process.env.VAULT_NETWORK = "sepolia";
  process.env.VAULT_NATIVE_TOKEN = "SEPETH";
  const config = getVaultConfig();
  assert.equal(config.network, "sepolia");
  assert.equal(config.chainId, 11155111);
  assert.equal(config.nativeTokenSymbol, "SEPETH");
});

test("getVaultConfig rejects unsupported networks", () => {
  process.env.VAULT_NETWORK = "optimism";
  assert.throws(() => getVaultConfig(), new RegExp(SUPPORTED_NETWORKS.join("|")));
});

test("resolveErc20Address resolves configured symbol", () => {
  process.env.VAULT_ERC20_TOKENS =
    "USDC:0x0000000000000000000000000000000000000003,DAI:0x0000000000000000000000000000000000000004";
  assert.equal(resolveErc20Address("usdc"), "0x0000000000000000000000000000000000000003");
});

test("key standard metadata is stable", () => {
  assert.equal(KEY_STANDARD_NAME, "Luckybox Deterministic Key Standard v1");
  assert.equal(
    KEY_STANDARD_METHOD,
    "scrypt(NFKD(passphrase), salt, N=32768,r=8,p=1,dkLen=32) -> BIP32/BIP44 m/44'/60'/0'/0/{index}"
  );
});

test("deriveSeed is deterministic", () => {
  process.env.BRAIN_WALLET_SALT = "test:salt:v1";
  const first = deriveSeed("correct horse battery staple");
  const second = deriveSeed("correct horse battery staple");
  assert.equal(toHex(first), toHex(second));
});

test("deriveSeed uses NFKD normalization", () => {
  process.env.BRAIN_WALLET_SALT = "test:salt:v1";
  assert.equal(toHex(deriveSeed("caf\u00E9")), toHex(deriveSeed("cafe\u0301")));
});

test("deriveSeed changes when salt changes", () => {
  process.env.BRAIN_WALLET_SALT = "salt:one";
  const one = deriveSeed("same passphrase");
  process.env.BRAIN_WALLET_SALT = "salt:two";
  const two = deriveSeed("same passphrase");
  assert.notEqual(toHex(one), toHex(two));
});

test("getDerivationPath builds BIP44 account path", () => {
  assert.equal(getDerivationPath(0), "m/44'/60'/0'/0/0");
  assert.equal(getDerivationPath(3), "m/44'/60'/0'/0/3");
});

test("deriveAddress is deterministic and index-sensitive", () => {
  process.env.BRAIN_WALLET_SALT = "wallet:test:salt";
  const seed = deriveSeed("wallet passphrase");
  const a0 = deriveAddress(seed, 0);
  const a0Again = deriveAddress(seed, 0);
  const a1 = deriveAddress(seed, 1);
  assert.equal(a0, a0Again);
  assert.notEqual(a0, a1);
});

test("wallet box alias conversion and derivation are consistent", () => {
  process.env.BRAIN_WALLET_SALT = "wallet:test:salt";
  assert.equal(boxToIndex("box1"), 0);
  assert.equal(boxToIndex("BoX9"), 8);
  assert.equal(indexToBox(0), "box1");
  assert.equal(indexToBox(8), "box9");

  const defaults = deriveDefaultWallets("unit passphrase");
  const box1 = deriveWalletByBox("unit passphrase", "box1");
  const box2 = deriveWalletByBox("unit passphrase", "box2");
  assert.equal(defaults[0]!.address, box1.address);
  assert.equal(defaults[1]!.address, box2.address);
});

test("reference vectors remain stable for deterministic key standard v1", () => {
  process.env.BRAIN_WALLET_SALT = "brainvault:v1:ethereum";
  const box1 = deriveWallet("correct horse battery staple", 0).address;
  const box2 = deriveWallet("correct horse battery staple", 1).address;
  assert.equal(box1, "0xf38D74C177A28c156F169d6D174b6a9EFA6A53A9");
  assert.equal(box2, "0x7094E2253d32Cbb37DdcB26d85F4Af843193Cf50");
});

test("formatPartialAddress masks full address", () => {
  const masked = formatPartialAddress("0x1234567890abcdef1234567890abcdef12345678");
  assert.equal(masked, "0x123...45678");
});

test("runAddressCommand prints masked address by default", async () => {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };

  try {
    await runAddressCommand({ box: "box1", passphrase: "unit test passphrase" });
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.length, 1);
  assert.match(logs[0]!, /^box1: 0x.{3}\.\.\..{5}$/i);
});

test("runBalanceCommand validates required alias argument", async () => {
  await assert.rejects(runBalanceCommand({ box: "" }), /Missing wallet alias/);
});

test("runSendCommand validates required amount option", async () => {
  await assert.rejects(
    runSendCommand({
      box: "box1",
      to: "0x0000000000000000000000000000000000000001",
      amount: "",
      passphrase: "unit test passphrase"
    }),
    /Missing required option "--amount"/
  );
});

async function main(): Promise<void> {
  let failed = 0;
  for (const item of cases) {
    restoreEnv();
    try {
      await item.run();
      console.log(`PASS ${item.name}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`FAIL ${item.name}`);
      console.error(message);
    }
  }

  restoreEnv();

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed.`);
    process.exit(1);
  }

  console.log(`\nAll ${cases.length} tests passed.`);
}

void main();
