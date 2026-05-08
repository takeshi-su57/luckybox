import { Args, Command, Flags } from "@oclif/core";
import { deriveWalletByBoxWithSalt, formatPartialAddress } from "../wallet/derive";
import { copyToClipboard } from "../io/clipboard";
import { resolvePassphrase } from "../io/passphrase";
import { resolveWalletSalt } from "../config/wallet-salt";
import { promptLine } from "../io/prompt";

export async function runAddressCommand(options: {
  box: string;
  show?: boolean;
  copy?: boolean;
  passphrase?: string;
  allowUnsafePassphrase?: boolean;
  passphraseStdin?: boolean;
  passphraseFile?: string;
  quiet?: boolean;
}): Promise<void> {
  if (!options.box) {
    throw new Error("Missing wallet alias. Usage: luckybox address box1 [--show] [--copy]");
  }

  const passphrase = (
    await resolvePassphrase({
      passphraseArg: options.passphrase,
      allowUnsafePassphrase: options.allowUnsafePassphrase,
      passphraseStdin: options.passphraseStdin,
      passphraseFile: options.passphraseFile,
      quiet: options.quiet
    })
  ).passphrase;
  const { salt } = await resolveWalletSalt({ prompt: promptLine });
  const wallet = deriveWalletByBoxWithSalt(passphrase, salt, options.box);
  const showFull = options.show ?? false;
  const shouldCopy = options.copy ?? false;

  const displayAddress = showFull ? wallet.address : formatPartialAddress(wallet.address);
  console.log(`${wallet.box}: ${displayAddress}`);

  if (shouldCopy) {
    const copied = copyToClipboard(wallet.address);
    if (!copied) {
      throw new Error("Failed to copy address to clipboard on this system.");
    }
    console.log("Address copied to clipboard.");
  }
}

export default class Address extends Command {
  static override summary = "Show one derived address.";

  static override args = {
    box: Args.string({
      required: true,
      description: "Address alias (box1, box2, ...)."
    })
  };

  static override flags = {
    copy: Flags.boolean({
      description: "Copy full address to clipboard."
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
    }),
    show: Flags.boolean({
      description: "Show full address."
    })
  };

  public override async run(): Promise<void> {
    const { args, flags } = await this.parse(Address);
    await runAddressCommand({
      box: args.box,
      allowUnsafePassphrase: flags["allow-unsafe-passphrase"],
      copy: flags.copy,
      passphrase: flags.passphrase,
      passphraseFile: flags["passphrase-file"],
      passphraseStdin: flags["passphrase-stdin"],
      quiet: flags.quiet,
      show: flags.show
    });
  }
}
