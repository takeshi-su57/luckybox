import { Command, Flags } from "@oclif/core";
import { printDefaultWallets } from "../app/wallet-summary";

export default class Unlock extends Command {
  static override summary = "Unlock deterministic keys for this session (no persistence).";

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
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(Unlock);
    await printDefaultWallets({
      command: this,
      allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
      passphrase: flags.passphrase,
      passphraseFile: flags["passphrase-file"],
      passphraseStdin: flags["passphrase-stdin"],
      introLine: "Keys unlocked for this session only."
    });
  }
}
