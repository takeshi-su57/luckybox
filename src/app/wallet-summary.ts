import { getVaultConfig } from "../config/env";
import { readPassphrase } from "../io/prompt";
import { deriveDefaultWallets, formatPartialAddress } from "../wallet/derive";
import { KEY_STANDARD_NAME } from "../wallet/standard";

export async function printDefaultWallets(options: {
  command: { log: (line: string) => void };
  passphrase?: string;
  confirmPassphrase?: boolean;
  showFullAddress?: boolean;
  introLine?: string;
}): Promise<void> {
  const passphrase = await readPassphrase({
    passphrase: options.passphrase,
    confirm: options.confirmPassphrase ?? false
  });
  const wallets = deriveDefaultWallets(passphrase);
  const config = getVaultConfig();
  const showFullAddress = options.showFullAddress ?? false;

  if (options.introLine) {
    options.command.log(options.introLine);
  }
  options.command.log(`Standard: ${KEY_STANDARD_NAME}`);
  options.command.log(`Network: ${config.network}`);
  for (const wallet of wallets) {
    options.command.log(
      `${wallet.box}: ${showFullAddress ? wallet.address : formatPartialAddress(wallet.address)}`
    );
  }
}
