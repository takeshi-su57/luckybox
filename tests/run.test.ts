import { beforeEach, describe, expect, it } from "vitest";
import process from "node:process";
import {
  DEFAULT_KDF_SALT,
  getVaultConfig,
  parseErc20TokenMap,
  resolveErc20Address
} from "../src/config/env";
import { SUPPORTED_NETWORKS } from "../src/config/chains";
import { runAddressCommand } from "../src/commands/address";
import { runBalanceCommand } from "../src/commands/balance";
import { runSendCommand } from "../src/commands/send";
import { deriveSeed } from "../src/crypto/kdf";
import { deriveAddress, getDerivationPath } from "../src/crypto/hd";
import { resolveRpcUrl } from "../src/config/rpc";
import {
  boxToIndex,
  deriveDefaultWallets,
  deriveWallet,
  deriveWalletByBox,
  formatPartialAddress,
  indexToBox
} from "../src/wallet/derive";
import { KEY_STANDARD_METHOD, KEY_STANDARD_NAME } from "../src/wallet/standard";

const ORIGINAL_ENV = { ...process.env };

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

beforeEach(() => {
  restoreEnv();
});

describe("deterministic key and CLI behavior", () => {
  it("parseErc20TokenMap parses symbol:address pairs", () => {
    const map = parseErc20TokenMap(
      "USDC:0x0000000000000000000000000000000000000001,DAI:0x0000000000000000000000000000000000000002"
    );
    expect(map.USDC).toBe("0x0000000000000000000000000000000000000001");
    expect(map.DAI).toBe("0x0000000000000000000000000000000000000002");
  });

  it("parseErc20TokenMap rejects entries with extra separators", () => {
    expect(() =>
      parseErc20TokenMap("USDC:0x0000000000000000000000000000000000000001:EXTRA")
    ).toThrow(/SYMBOL:ADDRESS/);
  });

  it("getVaultConfig applies defaults", () => {
    delete process.env.BRAIN_WALLET_SALT;
    delete process.env.VAULT_NETWORK;
    delete process.env.VAULT_NATIVE_TOKEN;
    delete process.env.VAULT_ERC20_TOKENS;

    const config = getVaultConfig();
    expect(config.kdfSalt).toBe(DEFAULT_KDF_SALT);
    expect(config.network).toBe("ethereum");
    expect(config.chainId).toBe(1);
    expect(config.nativeTokenSymbol).toBe("ETH");
    expect(config.erc20Tokens).toEqual({});
  });

  it("getVaultConfig reads supported network and native token overrides", () => {
    process.env.VAULT_NETWORK = "sepolia";
    process.env.VAULT_NATIVE_TOKEN = "SEPETH";
    const config = getVaultConfig();
    expect(config.network).toBe("sepolia");
    expect(config.chainId).toBe(11155111);
    expect(config.nativeTokenSymbol).toBe("SEPETH");
  });

  it("getVaultConfig rejects unsupported networks", () => {
    process.env.VAULT_NETWORK = "optimism";
    expect(() => getVaultConfig()).toThrow(new RegExp(SUPPORTED_NETWORKS.join("|")));
  });

  it("resolveErc20Address resolves configured symbol", () => {
    process.env.VAULT_ERC20_TOKENS =
      "USDC:0x0000000000000000000000000000000000000003,DAI:0x0000000000000000000000000000000000000004";
    expect(resolveErc20Address("usdc")).toBe("0x0000000000000000000000000000000000000003");
  });

  it("key standard metadata is stable", () => {
    expect(KEY_STANDARD_NAME).toBe("Luckybox Deterministic Key Standard v1");
    expect(KEY_STANDARD_METHOD).toBe(
      "scrypt(NFKD(passphrase), salt, N=32768,r=8,p=1,dkLen=32) -> BIP32/BIP44 m/44'/60'/0'/0/{index}"
    );
  });

  it("deriveSeed is deterministic", () => {
    process.env.BRAIN_WALLET_SALT = "test:salt:v1";
    const first = deriveSeed("correct horse battery staple");
    const second = deriveSeed("correct horse battery staple");
    expect(toHex(first)).toBe(toHex(second));
  });

  it("deriveSeed uses NFKD normalization", () => {
    process.env.BRAIN_WALLET_SALT = "test:salt:v1";
    expect(toHex(deriveSeed("caf\u00E9"))).toBe(toHex(deriveSeed("cafe\u0301")));
  });

  it("deriveSeed changes when salt changes", () => {
    process.env.BRAIN_WALLET_SALT = "salt:one";
    const one = deriveSeed("same passphrase");
    process.env.BRAIN_WALLET_SALT = "salt:two";
    const two = deriveSeed("same passphrase");
    expect(toHex(one)).not.toBe(toHex(two));
  });

  it("getDerivationPath builds BIP44 account path", () => {
    expect(getDerivationPath(0)).toBe("m/44'/60'/0'/0/0");
    expect(getDerivationPath(3)).toBe("m/44'/60'/0'/0/3");
  });

  it("deriveAddress is deterministic and index-sensitive", () => {
    process.env.BRAIN_WALLET_SALT = "wallet:test:salt";
    const seed = deriveSeed("wallet passphrase");
    const a0 = deriveAddress(seed, 0);
    const a0Again = deriveAddress(seed, 0);
    const a1 = deriveAddress(seed, 1);
    expect(a0).toBe(a0Again);
    expect(a0).not.toBe(a1);
  });

  it("wallet box alias conversion and derivation are consistent", () => {
    process.env.BRAIN_WALLET_SALT = "wallet:test:salt";
    expect(boxToIndex("box1")).toBe(0);
    expect(boxToIndex("BoX9")).toBe(8);
    expect(indexToBox(0)).toBe("box1");
    expect(indexToBox(8)).toBe("box9");

    const defaults = deriveDefaultWallets("unit passphrase");
    const box1 = deriveWalletByBox("unit passphrase", "box1");
    const box2 = deriveWalletByBox("unit passphrase", "box2");
    expect(defaults[0]?.address).toBe(box1.address);
    expect(defaults[1]?.address).toBe(box2.address);
  });

  it("reference vectors remain stable for deterministic key standard v1", () => {
    process.env.BRAIN_WALLET_SALT = "brainvault:v1:ethereum";
    const box1 = deriveWallet("correct horse battery staple", 0).address;
    const box2 = deriveWallet("correct horse battery staple", 1).address;
    expect(box1).toBe("0xf38D74C177A28c156F169d6D174b6a9EFA6A53A9");
    expect(box2).toBe("0x7094E2253d32Cbb37DdcB26d85F4Af843193Cf50");
  });

  it("formatPartialAddress masks full address", () => {
    const masked = formatPartialAddress("0x1234567890abcdef1234567890abcdef12345678");
    expect(masked).toBe("0x123...45678");
  });

  it("runAddressCommand prints masked address by default", async () => {
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

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^box1: 0x.{3}\.\.\..{5}$/i);
  });

  it("runAddressCommand missing alias usage references luckybox", async () => {
    await expect(runAddressCommand({ box: "" })).rejects.toThrow(
      "Missing wallet alias. Usage: luckybox address box1 [--show] [--copy]"
    );
  });

  it("runBalanceCommand missing alias usage references luckybox", async () => {
    await expect(runBalanceCommand({ box: "" })).rejects.toThrow(
      "Missing wallet alias. Usage: luckybox balance box1 [--rpc-url <url>]"
    );
  });

  it("runSendCommand missing alias usage references luckybox", async () => {
    await expect(
      runSendCommand({
        box: "",
        to: "0x0000000000000000000000000000000000000001",
        amount: "1",
        passphrase: "unit test passphrase"
      })
    ).rejects.toThrow(
      "Missing wallet alias. Usage: luckybox send box1 --to <address> --amount <value> [--token <symbol|address>] [--rpc-url <url>]"
    );
  });

  it("runSendCommand validates required amount option", async () => {
    await expect(
      runSendCommand({
        box: "box1",
        to: "0x0000000000000000000000000000000000000001",
        amount: "",
        passphrase: "unit test passphrase"
      })
    ).rejects.toThrow(/Missing required option "--amount"/);
  });

  it("runSendCommand rejects whitespace-only amount", async () => {
    await expect(
      runSendCommand({
        box: "box1",
        to: "0x0000000000000000000000000000000000000001",
        amount: "   ",
        passphrase: "unit test passphrase"
      })
    ).rejects.toThrow(/Invalid amount/);
  });

  it("runSendCommand rejects zero amount", async () => {
    await expect(
      runSendCommand({
        box: "box1",
        to: "0x0000000000000000000000000000000000000001",
        amount: "0",
        passphrase: "unit test passphrase"
      })
    ).rejects.toThrow(/Invalid amount/);
  });

  it("runSendCommand rejects negative amount", async () => {
    await expect(
      runSendCommand({
        box: "box1",
        to: "0x0000000000000000000000000000000000000001",
        amount: "-1",
        passphrase: "unit test passphrase"
      })
    ).rejects.toThrow(/Invalid amount/);
  });

  it("runSendCommand rejects malformed decimal amount", async () => {
    await expect(
      runSendCommand({
        box: "box1",
        to: "0x0000000000000000000000000000000000000001",
        amount: "1.2.3",
        passphrase: "unit test passphrase"
      })
    ).rejects.toThrow(/Invalid amount/);
  });

  it("resolveRpcUrl does not fall back to ETH_RPC_URL for non-shell usage", () => {
    process.env.ETH_RPC_URL = "https://legacy-env.example";
    expect(() => resolveRpcUrl()).toThrow(/Provide --rpc-url/);
  });

  it("getVaultConfig rejects whitespace-only BRAIN_WALLET_SALT", () => {
    process.env.BRAIN_WALLET_SALT = "   ";
    expect(() => getVaultConfig()).toThrow(/BRAIN_WALLET_SALT/);
  });

  it("parseErc20TokenMap rejects duplicate symbols", () => {
    expect(() =>
      parseErc20TokenMap(
        "USDC:0x0000000000000000000000000000000000000001,USDC:0x0000000000000000000000000000000000000002"
      )
    ).toThrow(/Duplicate ERC20 symbol/);
  });

  it("deriveSeed remains available with invalid VAULT_NETWORK", () => {
    process.env.BRAIN_WALLET_SALT = "test:salt:v2";
    process.env.VAULT_NETWORK = "invalid-network";
    const seed = deriveSeed("seed test");
    expect(seed.length).toBe(32);
  });
});
