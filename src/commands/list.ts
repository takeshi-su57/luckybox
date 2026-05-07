import { Command, Flags } from "@oclif/core";
import { printDefaultWallets } from "./wallet-summary";

export default class List extends Command {
  static override summary = "List box1 and box2 addresses (masked by default).";

  static override flags = {
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    }),
    show: Flags.boolean({
      description: "Show full addresses instead of masked addresses."
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(List);
    await printDefaultWallets({
      command: this,
      passphrase: flags.passphrase,
      showFullAddress: flags.show ?? false
    });
  }
}
