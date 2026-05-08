import { beforeEach, describe, expect, it, vi } from "vitest";
import process from "node:process";

const { getGlobalWalletSaltMock, setGlobalWalletSaltMock, resetWalletSaltMock } = vi.hoisted(() => {
  let walletSalt: string | undefined;
  return {
    getGlobalWalletSaltMock: vi.fn(async () => walletSalt),
    setGlobalWalletSaltMock: vi.fn(async (value: string) => {
      walletSalt = value.trim();
    }),
    resetWalletSaltMock: () => {
      walletSalt = undefined;
    }
  };
});

vi.mock("../src/config/local-config", () => ({
  getGlobalWalletSalt: getGlobalWalletSaltMock,
  setGlobalWalletSalt: setGlobalWalletSaltMock
}));

import { resolveWalletSalt } from "../src/config/wallet-salt";

const ORIGINAL_ENV = { ...process.env };

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
  restoreEnv();
  getGlobalWalletSaltMock.mockClear();
  setGlobalWalletSaltMock.mockClear();
  resetWalletSaltMock();
});

describe("wallet salt resolution", () => {
  it("prefers env override over persisted config", async () => {
    await setGlobalWalletSaltMock("config-salt");
    process.env.BRAIN_WALLET_SALT = "env-salt";

    const resolved = await resolveWalletSalt();
    expect(resolved.salt).toBe("env-salt");
    expect(resolved.source).toBe("env");
  });

  it("uses persisted global config when env is unset", async () => {
    await setGlobalWalletSaltMock("config-salt");

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
    await expect(getGlobalWalletSaltMock()).resolves.toBe("prompt-salt");
    expect(setGlobalWalletSaltMock).toHaveBeenCalledWith("prompt-salt");
  });

  it("rejects blank env override", async () => {
    process.env.BRAIN_WALLET_SALT = "   ";
    await expect(resolveWalletSalt()).rejects.toThrow(/BRAIN_WALLET_SALT/);
  });
});
