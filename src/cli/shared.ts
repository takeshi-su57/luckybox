import { spawnSync } from "node:child_process";
import process from "node:process";
import readline from "node:readline";

export async function promptLine(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return await new Promise<string>((resolve) => {
    rl.question(prompt, (value: string) => {
      rl.close();
      resolve(value);
    });
  });
}

export async function promptHidden(prompt: string): Promise<string> {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    typeof process.stdin.setRawMode !== "function"
  ) {
    return await promptLine(prompt);
  }

  process.stdout.write(prompt);

  return await new Promise<string>((resolve, reject) => {
    let value = "";

    const cleanup = (): void => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    const onData = (chunk: string | Buffer): void => {
      const text = chunk.toString("utf8");

      for (const character of text) {
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u0003") {
          cleanup();
          reject(new Error("Input interrupted."));
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

export async function readPassphrase(options?: {
  passphrase?: string;
  confirm?: boolean;
}): Promise<string> {
  const directPassphrase = options?.passphrase ?? process.env.BRAIN_PASSPHRASE;
  const requireConfirm = options?.confirm ?? false;

  if (directPassphrase !== undefined) {
    if (directPassphrase.normalize("NFKD").length === 0) {
      throw new Error("Passphrase cannot be empty.");
    }
    return directPassphrase;
  }

  const passphrase = await promptHidden("Enter passphrase: ");
  if (passphrase.normalize("NFKD").length === 0) {
    throw new Error("Passphrase cannot be empty.");
  }

  if (!requireConfirm) {
    return passphrase;
  }

  const confirmation = await promptHidden("Confirm passphrase: ");
  if (passphrase !== confirmation) {
    throw new Error("Passphrases do not match.");
  }

  return passphrase;
}

export function resolveRpcUrl(rpcUrlOverride?: string): string {
  const rpcUrl = rpcUrlOverride ?? process.env.ETH_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      "Missing RPC URL. Provide --rpc-url <url> or set ETH_RPC_URL in your environment."
    );
  }
  return rpcUrl;
}

export function copyToClipboard(text: string): boolean {
  const platform = process.platform;
  const attempts: Array<{ cmd: string; args: string[] }> = [];

  if (platform === "win32") {
    attempts.push({ cmd: "clip", args: [] });
  } else if (platform === "darwin") {
    attempts.push({ cmd: "pbcopy", args: [] });
  } else {
    attempts.push({ cmd: "wl-copy", args: [] });
    attempts.push({ cmd: "xclip", args: ["-selection", "clipboard"] });
    attempts.push({ cmd: "xsel", args: ["--clipboard", "--input"] });
  }

  for (const attempt of attempts) {
    const result = spawnSync(attempt.cmd, attempt.args, {
      input: text,
      stdio: ["pipe", "ignore", "ignore"]
    });

    if (!result.error && result.status === 0) {
      return true;
    }
  }

  return false;
}
