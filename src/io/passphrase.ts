import process from "node:process";
import { readFile as readFileNode } from "node:fs/promises";
import { promptHidden as promptHiddenDefault } from "./prompt";

export type PassphraseSource = "stdin" | "file" | "prompt" | "arg" | "env";

export type ResolvedPassphrase = {
  passphrase: string;
  source: PassphraseSource;
  unsafe: boolean;
};

export type ResolvePassphraseOptions = {
  passphraseArg?: string;
  allowUnsafePassphrase?: boolean;
  passphraseStdin?: boolean;
  passphraseFile?: string;
  quiet?: boolean;
  stdin?: Buffer;
  readFile?: (path: string) => Promise<Buffer>;
  promptHidden?: (prompt: string) => Promise<string>;
  warn?: (msg: string) => void;
};

function trimSingleTrailingNewline(value: string): string {
  if (value.endsWith("\r\n")) return value.slice(0, -2);
  if (value.endsWith("\n")) return value.slice(0, -1);
  return value;
}

function normalizeNonEmpty(passphrase: string): string {
  const normalized = passphrase.normalize("NFKD");
  if (normalized.length === 0) {
    throw new Error("Passphrase cannot be empty.");
  }
  return normalized;
}

async function readAllStdinUtf8(): Promise<string> {
  const chunks: Buffer[] = [];
  return await new Promise<string>((resolve, reject) => {
    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

export async function resolvePassphrase(
  options: ResolvePassphraseOptions = {}
): Promise<ResolvedPassphrase> {
  const warn = options.warn ?? ((msg: string) => process.stderr.write(`${msg}\n`));

  if (options.passphraseStdin) {
    const raw = options.stdin ? options.stdin.toString("utf8") : await readAllStdinUtf8();
    const passphrase = trimSingleTrailingNewline(raw);
    return { passphrase: normalizeNonEmpty(passphrase), source: "stdin", unsafe: false };
  }

  if (options.passphraseFile) {
    const rf = options.readFile ?? (async (path: string) => await readFileNode(path));
    const raw = (await rf(options.passphraseFile)).toString("utf8");
    const passphrase = trimSingleTrailingNewline(raw);
    return { passphrase: normalizeNonEmpty(passphrase), source: "file", unsafe: false };
  }

  if (options.allowUnsafePassphrase) {
    const direct = options.passphraseArg ?? process.env.BRAIN_PASSPHRASE;
    if (direct !== undefined) {
      if (!options.quiet) {
        warn("Warning: using unsafe passphrase input (may leak via shell history/process/env).");
      }
      return {
        passphrase: normalizeNonEmpty(direct),
        source: options.passphraseArg ? "arg" : "env",
        unsafe: true
      };
    }
  }

  const promptHidden = options.promptHidden ?? promptHiddenDefault;
  const passphrase = await promptHidden("Enter passphrase: ");
  return { passphrase: normalizeNonEmpty(passphrase), source: "prompt", unsafe: false };
}
