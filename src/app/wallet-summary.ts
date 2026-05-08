import { getVaultConfig } from "../config/env";
import { resolvePassphrase } from "../io/passphrase";
import { deriveDefaultWalletsWithSalt, formatPartialAddress } from "../wallet/derive";
import { KEY_STANDARD_NAME } from "../wallet/standard";
import { resolveWalletSalt } from "../config/wallet-salt";
import { promptLine } from "../io/prompt";

export async function printDefaultWallets(options: {
  command: { log: (line: string) => void };
  passphraseResolved?: string;
  passphrase?: string;
  allowUnsafePassphrase?: boolean;
  passphraseStdin?: boolean;
  passphraseFile?: string;
  quiet?: boolean;
  confirmPassphrase?: boolean;
  showFullAddress?: boolean;
  introLine?: string;
}): Promise<void> {
  if (options.confirmPassphrase) {
    throw new Error(
      "Passphrase confirmation is not supported with the hardened passphrase resolver."
    );
  }

  const passphrase =
    options.passphraseResolved ??
    (
      await resolvePassphrase({
        passphraseArg: options.passphrase,
        allowUnsafePassphrase: options.allowUnsafePassphrase,
        passphraseStdin: options.passphraseStdin,
        passphraseFile: options.passphraseFile,
        quiet: options.quiet
      })
    ).passphrase;
  const { salt } = await resolveWalletSalt({ prompt: promptLine });
  const wallets = deriveDefaultWalletsWithSalt(passphrase, salt);
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
