import process from "node:process";
import { getGlobalWalletSalt, setGlobalWalletSalt } from "./local-config";

export type WalletSaltSource = "env" | "config" | "prompt";

export type ResolvedWalletSalt = {
  salt: string;
  source: WalletSaltSource;
};

export async function resolveWalletSalt(options?: {
  prompt?: (message: string) => Promise<string>;
}): Promise<ResolvedWalletSalt> {
  const rawEnv = process.env.BRAIN_WALLET_SALT;
  if (rawEnv !== undefined) {
    const trimmed = rawEnv.trim();
    if (trimmed.length === 0) {
      throw new Error("Invalid BRAIN_WALLET_SALT: value cannot be blank.");
    }
    return { salt: trimmed, source: "env" };
  }

  const fromConfig = await getGlobalWalletSalt();
  if (fromConfig) {
    return { salt: fromConfig, source: "config" };
  }

  const prompt = options?.prompt;
  if (!prompt) {
    throw new Error("Wallet salt is not set. Run `luckybox salt set` or set BRAIN_WALLET_SALT.");
  }

  const input = (await prompt("Enter wallet salt: ")).trim();
  if (input.length === 0) {
    throw new Error("Wallet salt cannot be blank.");
  }

  await setGlobalWalletSalt(input);
  return { salt: input, source: "prompt" };
}
