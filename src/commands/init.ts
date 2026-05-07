import { Command, Flags } from "@oclif/core";
import { getVaultConfig } from "../config/env";
import { deriveDefaultWallets, formatPartialAddress } from "../wallet/derive";
import { KEY_STANDARD_NAME } from "../wallet/standard";
import { readPassphrase } from "../cli/shared";

export default class Init extends Command {
  static override summary = "Initialize deterministic keys for this session (no persistence).";

  static override flags = {
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const passphrase = await readPassphrase({ passphrase: flags.passphrase, confirm: true });
    const wallets = deriveDefaultWallets(passphrase);
    const config = getVaultConfig();

    this.log("Initialized deterministic key session. Nothing was persisted.");
    this.log(`Standard: ${KEY_STANDARD_NAME}`);
    this.log(`Network: ${config.network}`);
    for (const wallet of wallets) {
      this.log(`${wallet.box}: ${formatPartialAddress(wallet.address)}`);
    }
  }
}
