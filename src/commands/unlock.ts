import { Command, Flags } from "@oclif/core";
import { printDefaultWallets } from "./wallet-summary";

export default class Unlock extends Command {
  static override summary = "Unlock deterministic keys for this session (no persistence).";

  static override flags = {
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(Unlock);
    await printDefaultWallets({
      command: this,
      passphrase: flags.passphrase,
      introLine: "Keys unlocked for this session only."
    });
  }
}
