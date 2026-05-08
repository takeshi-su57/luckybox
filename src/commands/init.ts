import { Command, Flags } from "@oclif/core";
import { printDefaultWallets } from "../app/wallet-summary";

export default class Init extends Command {
  static override summary = "Initialize deterministic keys for this session (no persistence).";

  static override flags = {
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    await printDefaultWallets({
      command: this,
      passphrase: flags.passphrase,
      confirmPassphrase: true,
      introLine: "Initialized deterministic key session. Nothing was persisted."
    });
  }
}
