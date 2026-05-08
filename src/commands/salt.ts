import { Args, Command } from "@oclif/core";
import {
  clearGlobalWalletSalt,
  getGlobalWalletSalt,
  setGlobalWalletSalt
} from "../config/local-config";
import { resolveWalletSalt } from "../config/wallet-salt";
import { promptLine } from "../io/prompt";

type SaltAction = "get" | "set" | "clear";

function parseAction(raw: string | undefined): SaltAction {
  const value = (raw ?? "get").toLowerCase();
  if (value === "get" || value === "set" || value === "clear") return value;
  throw new Error('Invalid action. Use "get", "set", or "clear".');
}

export default class Salt extends Command {
  static override summary = "Get or manage the global wallet salt.";

  static override args = {
    action: Args.string({
      required: false,
      description: 'Action: "get" (default), "set", or "clear".'
    })
  };

  public override async run(): Promise<void> {
    const { args } = await this.parse(Salt);
    const action = parseAction(args.action);

    if (action === "get") {
      const resolved = await resolveWalletSalt();
      this.log(`Wallet salt: ${resolved.salt}`);
      this.log(`Source: ${resolved.source}`);
      return;
    }

    if (action === "set") {
      this.log("Warning: changing the wallet salt will change all derived addresses.");
      const nextSalt = (await promptLine("New wallet salt: ")).trim();
      if (!nextSalt) throw new Error("Wallet salt cannot be blank.");

      const confirmation = (await promptLine('Type "CHANGE SALT" to continue: ')).trim();
      if (confirmation !== "CHANGE SALT") {
        this.log("Cancelled.");
        return;
      }

      await setGlobalWalletSalt(nextSalt);
      this.log("Wallet salt updated.");
      return;
    }

    // clear
    const current = await getGlobalWalletSalt();
    if (!current) {
      this.log("Wallet salt is not set in config.");
      return;
    }

    this.log("Warning: clearing the wallet salt will require re-entry on next use.");
    const confirmation = (await promptLine('Type "CLEAR SALT" to continue: ')).trim();
    if (confirmation !== "CLEAR SALT") {
      this.log("Cancelled.");
      return;
    }

    await clearGlobalWalletSalt();
    this.log("Wallet salt cleared.");
  }
}
