import { Args, Command, Flags } from "@oclif/core";
import { deriveWalletByBox, formatPartialAddress } from "../wallet/derive";
import { copyToClipboard } from "../io/clipboard";
import { readPassphrase } from "../io/prompt";

export async function runAddressCommand(options: {
  box: string;
  show?: boolean;
  copy?: boolean;
  passphrase?: string;
}): Promise<void> {
  if (!options.box) {
    throw new Error("Missing wallet alias. Usage: vault address box1 [--show] [--copy]");
  }

  const passphrase = await readPassphrase({ passphrase: options.passphrase });
  const wallet = deriveWalletByBox(passphrase, options.box);
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
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    }),
    show: Flags.boolean({
      description: "Show full address."
    })
  };

  public override async run(): Promise<void> {
    const { args, flags } = await this.parse(Address);
    await runAddressCommand({
      box: args.box,
      copy: flags.copy,
      passphrase: flags.passphrase,
      show: flags.show
    });
  }
}
