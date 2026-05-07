import { spawnSync } from "node:child_process";
import process from "node:process";

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
