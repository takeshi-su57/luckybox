import { deriveWalletByBox, formatPartialAddress } from "../wallet/derive";
import { copyToClipboard, readPassphrase } from "./shared";

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
