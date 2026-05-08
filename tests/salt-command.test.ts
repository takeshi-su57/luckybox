import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveWalletSaltMock,
  getGlobalWalletSaltMock,
  setGlobalWalletSaltMock,
  clearGlobalWalletSaltMock,
  promptLineMock
} = vi.hoisted(() => {
  return {
    resolveWalletSaltMock: vi.fn(),
    getGlobalWalletSaltMock: vi.fn(),
    setGlobalWalletSaltMock: vi.fn(),
    clearGlobalWalletSaltMock: vi.fn(),
    promptLineMock: vi.fn()
  };
});

vi.mock("../src/config/wallet-salt", () => ({
  resolveWalletSalt: resolveWalletSaltMock
}));

vi.mock("../src/config/local-config", () => ({
  getGlobalWalletSalt: getGlobalWalletSaltMock,
  setGlobalWalletSalt: setGlobalWalletSaltMock,
  clearGlobalWalletSalt: clearGlobalWalletSaltMock
}));

vi.mock("../src/io/prompt", () => ({
  promptLine: promptLineMock
}));

import Salt from "../src/commands/salt";

function createFakeCommand(action: string | undefined) {
  const logs: string[] = [];
  const fake = {
    parse: vi.fn(async () => ({ args: { action } })),
    log: (line: string) => logs.push(line)
  };
  return { fake, logs };
}

describe("salt command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("salt get prints current salt and source", async () => {
    resolveWalletSaltMock.mockResolvedValue({ salt: "abc", source: "config" });
    const { fake, logs } = createFakeCommand("get");

    await Salt.prototype.run.call(fake as never);

    expect(resolveWalletSaltMock).toHaveBeenCalledTimes(1);
    expect(logs).toEqual(["Wallet salt: abc", "Source: config"]);
  });

  it("salt set updates salt after confirmation", async () => {
    promptLineMock.mockResolvedValueOnce("next-salt").mockResolvedValueOnce("CHANGE SALT");
    const { fake, logs } = createFakeCommand("set");

    await Salt.prototype.run.call(fake as never);

    expect(setGlobalWalletSaltMock).toHaveBeenCalledWith("next-salt");
    expect(logs).toContain("Warning: changing the wallet salt will change all derived addresses.");
    expect(logs).toContain("Wallet salt updated.");
  });

  it("salt set cancels on wrong confirmation", async () => {
    promptLineMock.mockResolvedValueOnce("next-salt").mockResolvedValueOnce("NO");
    const { fake, logs } = createFakeCommand("set");

    await Salt.prototype.run.call(fake as never);

    expect(setGlobalWalletSaltMock).not.toHaveBeenCalled();
    expect(logs).toContain("Cancelled.");
  });

  it("salt clear reports missing config salt", async () => {
    getGlobalWalletSaltMock.mockResolvedValue(undefined);
    const { fake, logs } = createFakeCommand("clear");

    await Salt.prototype.run.call(fake as never);

    expect(clearGlobalWalletSaltMock).not.toHaveBeenCalled();
    expect(logs).toContain("Wallet salt is not set in config.");
  });

  it("salt clear removes salt after confirmation", async () => {
    getGlobalWalletSaltMock.mockResolvedValue("abc");
    promptLineMock.mockResolvedValueOnce("CLEAR SALT");
    const { fake, logs } = createFakeCommand("clear");

    await Salt.prototype.run.call(fake as never);

    expect(clearGlobalWalletSaltMock).toHaveBeenCalledTimes(1);
    expect(logs).toContain("Wallet salt cleared.");
  });
});
