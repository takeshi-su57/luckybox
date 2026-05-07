import { Args, Command, Flags } from "@oclif/core";
import { runAddressCommand } from "../cli/address";

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
