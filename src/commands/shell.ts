import { Command } from "@oclif/core";
import { executeShellSession } from "../app/shell";
import { promptLine, readPassphrase } from "../io/prompt";

export default class Shell extends Command {
  static override summary =
    "Start interactive shell mode and reuse one in-memory passphrase for subsequent commands.";

  public override async run(): Promise<void> {
    await executeShellSession({
      promptLine,
      readPassphrase,
      log: (line) => this.log(line)
    });
  }
}
