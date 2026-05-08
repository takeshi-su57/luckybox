import { Command, Flags } from "@oclif/core";
import { executeShellSession } from "../app/shell";
import { promptLine } from "../io/prompt";
import { resolvePassphrase } from "../io/passphrase";
import { resolveWalletSalt } from "../config/wallet-salt";

export default class Shell extends Command {
  static override summary =
    "Start interactive shell mode and reuse one in-memory passphrase for subsequent commands.";

  static override flags = {
    "passphrase-stdin": Flags.boolean({
      description: "Read passphrase from stdin (recommended for automation/tests)."
    }),
    "passphrase-file": Flags.string({
      description: "Read passphrase from file (recommended for automation/tests)."
    }),
    "allow-unsafe-passphrase": Flags.boolean({
      description: "Allow unsafe passphrase sources (env/--passphrase). Intended for tests."
    }),
    passphrase: Flags.string({
      description: "UNSAFE: passphrase via CLI arg (requires --allow-unsafe-passphrase)."
    }),
    quiet: Flags.boolean({
      description: "Suppress warnings."
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(Shell);
    const resolved = await resolvePassphrase({
      passphraseArg: flags.passphrase,
      allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
      passphraseStdin: flags["passphrase-stdin"],
      passphraseFile: flags["passphrase-file"],
      quiet: flags.quiet
    });

    await executeShellSession({
      promptLine,
      readPassphrase: async () => resolved.passphrase,
      resolveWalletSalt: async () => (await resolveWalletSalt({ prompt: promptLine })).salt,
      log: (line) => this.log(line)
    });
  }
}
