import { Command, Flags } from "@oclif/core";
import { printDefaultWallets } from "../app/wallet-summary";
import { resolvePassphrase } from "../io/passphrase";
import { promptHidden } from "../io/prompt";

export default class Init extends Command {
  static override summary = "Initialize deterministic keys for this session (no persistence).";

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
    const { flags } = await this.parse(Init);
    const resolved = await resolvePassphrase({
      allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
      passphraseArg: flags.passphrase,
      passphraseFile: flags["passphrase-file"],
      passphraseStdin: flags["passphrase-stdin"]
    });

    if (resolved.source === "prompt") {
      const confirmation = await promptHidden("Confirm passphrase: ");
      if (resolved.passphrase !== confirmation.normalize("NFKD")) {
        throw new Error("Passphrases do not match.");
      }
    }

    await printDefaultWallets({
      command: this,
      passphraseResolved: resolved.passphrase,
      introLine: "Initialized deterministic key session. Nothing was persisted."
    });
  }
}
