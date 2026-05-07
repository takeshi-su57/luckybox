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
