import { Command, Flags } from "@oclif/core";
import { getVaultConfig } from "../config/env";
import { deriveDefaultWallets, formatPartialAddress } from "../wallet/derive";
import { KEY_STANDARD_NAME } from "../wallet/standard";
import { readPassphrase } from "../cli/shared";

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
    const passphrase = await readPassphrase({ passphrase: flags.passphrase });
    const wallets = deriveDefaultWallets(passphrase);
    const config = getVaultConfig();

    this.log(`Standard: ${KEY_STANDARD_NAME}`);
    this.log(`Network: ${config.network}`);
    for (const wallet of wallets) {
      this.log(`${wallet.box}: ${flags.show ? wallet.address : formatPartialAddress(wallet.address)}`);
    }
  }
}
