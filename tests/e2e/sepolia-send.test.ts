import { beforeEach, describe, expect, it, vi } from "vitest";
import process from "node:process";
import { runSendCommand } from "../../src/commands/send";
import {
  getErc20SendAmount,
  getNativeSendAmount,
  getTestTokenSymbol,
  hasEnv,
  requireEnv
} from "../testnet/helpers";

vi.mock("../../src/io/prompt", async () => {
  const actual = await vi.importActual<typeof import("../../src/io/prompt")>("../../src/io/prompt");
  return {
    ...actual,
    promptLine: vi.fn(async () => "send"),
    readPassphrase: vi.fn(async (options?: { passphrase?: string }) => {
      return options?.passphrase ?? process.env.BRAIN_PASSPHRASE ?? "";
    })
  };
});

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

const e2eReady =
  process.env.TEST_ENABLE_E2E === "true" &&
  hasEnv("ETH_RPC_URL") &&
  hasEnv("BRAIN_WALLET_SALT") &&
  hasEnv("BRAIN_PASSPHRASE") &&
  hasEnv("VAULT_ERC20_TOKENS");

const maybeDescribe = e2eReady ? describe : describe.skip;

beforeEach(() => {
  restoreEnv();
  process.env.VAULT_NETWORK = "sepolia";
});

maybeDescribe("Sepolia live send e2e", () => {
  it("sends a small native transfer from box1 to box2", async () => {
    requireEnv("ETH_RPC_URL");
    requireEnv("BRAIN_PASSPHRASE");

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    };

    try {
      await runSendCommand({
        box: "box1",
        to: requireEnv("TEST_RECIPIENT_ADDRESS"),
        amount: getNativeSendAmount(),
        passphrase: process.env.BRAIN_PASSPHRASE
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs.some((line) => line.startsWith("Sent: 0x"))).toBe(true);
  }, 60_000);

  it("sends a small ERC20 transfer from box1 to recipient", async () => {
    requireEnv("ETH_RPC_URL");
    requireEnv("BRAIN_PASSPHRASE");
    requireEnv("VAULT_ERC20_TOKENS");

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    };

    try {
      await runSendCommand({
        box: "box1",
        to: requireEnv("TEST_RECIPIENT_ADDRESS"),
        token: getTestTokenSymbol(),
        amount: getErc20SendAmount(),
        passphrase: process.env.BRAIN_PASSPHRASE
      });
    } finally {
      console.log = originalLog;
    }

    expect(logs.some((line) => line.startsWith("Token Contract: 0x"))).toBe(true);
    expect(logs.some((line) => line.startsWith("Sent: 0x"))).toBe(true);
  }, 60_000);
});
