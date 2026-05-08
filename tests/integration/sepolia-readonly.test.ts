import { beforeEach, describe, expect, it } from "vitest";
import process from "node:process";
import { runAddressCommand } from "../../src/commands/address";
import { runBalanceCommand } from "../../src/commands/balance";
import { hasEnv, requireEnv, getTestTokenSymbol } from "../testnet/helpers";

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

const integrationReady =
  hasEnv("ETH_RPC_URL") &&
  hasEnv("BRAIN_WALLET_SALT") &&
  hasEnv("BRAIN_PASSPHRASE") &&
  hasEnv("VAULT_ERC20_TOKENS");

const maybeDescribe = integrationReady ? describe : describe.skip;

beforeEach(() => {
  restoreEnv();
});

maybeDescribe("Sepolia read-only integration", () => {
  it("derives and prints a full box1 address", async () => {
    requireEnv("BRAIN_PASSPHRASE");
    process.env.VAULT_NETWORK = "sepolia";

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    };

    try {
      await runAddressCommand({
        box: "box1",
        show: true,
        passphrase: process.env.BRAIN_PASSPHRASE
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^box1: 0x[a-fA-F0-9]{40}$/);
  });

  it("reads native balance for box1 on sepolia", async () => {
    const rpcUrl = requireEnv("ETH_RPC_URL");
    requireEnv("BRAIN_PASSPHRASE");
    process.env.VAULT_NETWORK = "sepolia";

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    };

    try {
      await runBalanceCommand({
        box: "box1",
        passphrase: process.env.BRAIN_PASSPHRASE,
        rpcUrl
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs.some((line) => line.startsWith("Network: sepolia"))).toBe(true);
    expect(logs.some((line) => line.startsWith("Balance: "))).toBe(true);
  }, 30_000);

  it("reads ERC20 balance for box1 on sepolia", async () => {
    const rpcUrl = requireEnv("ETH_RPC_URL");
    requireEnv("BRAIN_PASSPHRASE");
    requireEnv("VAULT_ERC20_TOKENS");
    process.env.VAULT_NETWORK = "sepolia";
    const tokenSymbol = getTestTokenSymbol();

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    };

    try {
      await runBalanceCommand({
        box: "box1",
        token: tokenSymbol,
        passphrase: process.env.BRAIN_PASSPHRASE,
        rpcUrl
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs.some((line) => line.startsWith("Network: sepolia"))).toBe(true);
    expect(logs.some((line) => line.startsWith("Balance: "))).toBe(true);
    expect(logs.some((line) => line.startsWith("Token: 0x"))).toBe(true);
  }, 30_000);
});
