import { describe, expect, it, vi } from "vitest";

vi.mock("node:readline", () => {
  return {
    default: {
      createInterface: () => ({
        question: (_prompt: string, cb: (value: string) => void) => cb("not-secret"),
        close: () => {}
      })
    }
  };
});

describe("promptHidden", () => {
  it("fails closed when TTY is unavailable", async () => {
    const { promptHidden } = await import("../src/io/prompt.js");

    type StdinLike = typeof process.stdin & {
      isTTY?: boolean;
      setRawMode?: (mode: boolean) => void;
    };
    type StdoutLike = typeof process.stdout & { isTTY?: boolean };

    const stdin = process.stdin as StdinLike;
    const stdout = process.stdout as StdoutLike;

    const stdinIsTTY = process.stdin.isTTY;
    const stdoutIsTTY = process.stdout.isTTY;
    const setRawMode = stdin.setRawMode;

    stdin.isTTY = false;
    stdout.isTTY = false;
    (stdin as unknown as { setRawMode?: unknown }).setRawMode = undefined;

    await expect(promptHidden("Enter: ")).rejects.toThrow(/Hidden prompt unavailable/i);

    stdin.isTTY = stdinIsTTY;
    stdout.isTTY = stdoutIsTTY;
    stdin.setRawMode = setRawMode;
  });
});

describe("resolvePassphrase", () => {
  it("reads from stdin when passphraseStdin is true", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase.js");
    const stdin = Buffer.from("hello\n", "utf8");
    const result = await resolvePassphrase({
      passphraseStdin: true,
      stdin,
      promptHidden: async () => {
        throw new Error("should not prompt");
      }
    });
    expect(result.passphrase).toBe("hello");
    expect(result.source).toBe("stdin");
    expect(result.unsafe).toBe(false);
  });

  it("reads from file when passphraseFile is provided", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase.js");
    const result = await resolvePassphrase({
      passphraseFile: "C:\\\\tmp\\\\passphrase.txt",
      readFile: async () => Buffer.from("filepass\r\n", "utf8"),
      promptHidden: async () => {
        throw new Error("should not prompt");
      }
    });
    expect(result.passphrase).toBe("filepass");
    expect(result.source).toBe("file");
    expect(result.unsafe).toBe(false);
  });

  it("prompts hidden by default", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase.js");
    const result = await resolvePassphrase({
      promptHidden: async () => "promptpass"
    });
    expect(result.passphrase).toBe("promptpass");
    expect(result.source).toBe("prompt");
    expect(result.unsafe).toBe(false);
  });

  it("ignores env passphrase unless allowUnsafePassphrase is true", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase.js");
    process.env.BRAIN_PASSPHRASE = "envpass";
    const result = await resolvePassphrase({
      promptHidden: async () => "promptpass"
    });
    expect(result.passphrase).toBe("promptpass");
    expect(result.source).toBe("prompt");
    expect(result.unsafe).toBe(false);
    delete process.env.BRAIN_PASSPHRASE;
  });

  it("uses env passphrase when allowUnsafePassphrase is true", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase.js");
    process.env.BRAIN_PASSPHRASE = "envpass";
    const result = await resolvePassphrase({
      allowUnsafePassphrase: true,
      quiet: true,
      promptHidden: async () => {
        throw new Error("should not prompt");
      }
    });
    expect(result.passphrase).toBe("envpass");
    expect(result.source).toBe("env");
    expect(result.unsafe).toBe(true);
    delete process.env.BRAIN_PASSPHRASE;
  });

  it("uses arg passphrase when allowUnsafePassphrase is true", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase.js");
    const result = await resolvePassphrase({
      allowUnsafePassphrase: true,
      passphraseArg: "argpass",
      quiet: true,
      promptHidden: async () => {
        throw new Error("should not prompt");
      }
    });
    expect(result.passphrase).toBe("argpass");
    expect(result.source).toBe("arg");
    expect(result.unsafe).toBe(true);
  });
});
