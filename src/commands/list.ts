import { Command, Flags } from "@oclif/core";
import { printDefaultWallets } from "../app/wallet-summary";

export default class List extends Command {
  static override summary = "List box1 and box2 addresses (masked by default).";

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
    }),
    show: Flags.boolean({
      description: "Show full addresses instead of masked addresses."
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(List);
    await printDefaultWallets({
      command: this,
      allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
      passphrase: flags.passphrase,
      passphraseFile: flags["passphrase-file"],
      passphraseStdin: flags["passphrase-stdin"],
      quiet: flags.quiet,
      showFullAddress: flags.show ?? false
    });
  }
}
