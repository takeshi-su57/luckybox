import { Args, Command, Flags } from "@oclif/core";
import { resolvePassphrase } from "../io/passphrase";
import { promptLine } from "../io/prompt";
import { derivePrivateKeyByBoxWithSalt } from "../wallet/derive";
import { resolveWalletSalt } from "../config/wallet-salt";

export default class PrivateKey extends Command {
  static override summary = "Export the private key for a derived alias (dangerous).";

  static override args = {
    box: Args.string({
      required: true,
      description: "Address alias (box1, box2, ...)."
    })
  };

  static override flags = {
    show: Flags.boolean({
      description: "Actually print the private key."
    }),
    yes: Flags.boolean({
      char: "y",
      description: "Skip interactive confirmation."
    }),
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
    const { args, flags } = await this.parse(PrivateKey);

    if (!flags.show) {
      throw new Error('Refusing to print private key without "--show".');
    }

    if (!flags.yes) {
      const typed = (await promptLine('Type "SHOW" to continue: ')).trim();
      if (typed !== "SHOW") {
        this.log("Cancelled.");
        return;
      }
    }

    const passphrase = (
      await resolvePassphrase({
        passphraseArg: flags.passphrase,
        allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
        passphraseStdin: flags["passphrase-stdin"],
        passphraseFile: flags["passphrase-file"],
        quiet: flags.quiet
      })
    ).passphrase;

    const { salt } = await resolveWalletSalt({ prompt: promptLine });
    const privateKey = derivePrivateKeyByBoxWithSalt(passphrase, salt, args.box);
    this.log(privateKey);
  }
}
