import { Command, Flags } from "@oclif/core";
import { getVaultConfig } from "../config/env";
import { deriveDefaultWallets, formatPartialAddress } from "../wallet/derive";
import { KEY_STANDARD_NAME } from "../wallet/standard";
import { readPassphrase } from "../cli/shared";

export default class Unlock extends Command {
  static override summary = "Unlock deterministic keys for this session (no persistence).";

  static override flags = {
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    })
  };

  public override async run(): Promise<void> {
    const { flags } = await this.parse(Unlock);
    const passphrase = await readPassphrase({ passphrase: flags.passphrase });
    const wallets = deriveDefaultWallets(passphrase);
    const config = getVaultConfig();

    this.log("Keys unlocked for this session only.");
    this.log(`Standard: ${KEY_STANDARD_NAME}`);
    this.log(`Network: ${config.network}`);
    for (const wallet of wallets) {
      this.log(`${wallet.box}: ${formatPartialAddress(wallet.address)}`);
    }
  }
}
