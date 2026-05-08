import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import process from "node:process";
import {
  clearGlobalWalletSalt,
  getGlobalWalletSalt,
  setGlobalWalletSalt
} from "../src/config/local-config";
import { resolveWalletSalt } from "../src/config/wallet-salt";

const ORIGINAL_ENV = { ...process.env };
const CONFIG_PATH = `${process.cwd()}\\config.json`;
let originalConfigExists = false;
let originalConfigContent = "";

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  originalConfigExists = existsSync(CONFIG_PATH);
  originalConfigContent = originalConfigExists ? readFileSync(CONFIG_PATH, "utf8") : "";
  if (originalConfigExists) {
    unlinkSync(CONFIG_PATH);
  }
  restoreEnv();
});

afterEach(() => {
  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
  }
  if (originalConfigExists) {
    writeFileSync(CONFIG_PATH, originalConfigContent, "utf8");
  }
  restoreEnv();
});

describe("wallet salt resolution", () => {
  it("prefers env override over persisted config", async () => {
    await setGlobalWalletSalt("config-salt");
    process.env.BRAIN_WALLET_SALT = "env-salt";

    const resolved = await resolveWalletSalt();
    expect(resolved.salt).toBe("env-salt");
    expect(resolved.source).toBe("env");
  });

  it("uses persisted global config when env is unset", async () => {
    await setGlobalWalletSalt("config-salt");

    const resolved = await resolveWalletSalt();
    expect(resolved.salt).toBe("config-salt");
    expect(resolved.source).toBe("config");
  });

  it("prompts and persists when missing", async () => {
    const resolved = await resolveWalletSalt({
      prompt: async () => "prompt-salt"
    });

    expect(resolved.salt).toBe("prompt-salt");
    expect(resolved.source).toBe("prompt");
    await expect(getGlobalWalletSalt()).resolves.toBe("prompt-salt");
  });

  it("clears persisted global salt", async () => {
    await setGlobalWalletSalt("to-clear");
    await clearGlobalWalletSalt();

    await expect(getGlobalWalletSalt()).resolves.toBeUndefined();
  });

  it("rejects blank env override", async () => {
    process.env.BRAIN_WALLET_SALT = "   ";
    await expect(resolveWalletSalt()).rejects.toThrow(/BRAIN_WALLET_SALT/);
  });
});
