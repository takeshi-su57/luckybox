import { Args, Command, Flags } from "@oclif/core";
import { runBalanceCommand } from "../cli/balance";

export default class Balance extends Command {
  static override summary = "Fetch native or ERC20 balance for an address alias.";

  static override args = {
    box: Args.string({
      required: true,
      description: "Address alias (box1, box2, ...)."
    })
  };

  static override flags = {
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    }),
    "rpc-url": Flags.string({
      description: "RPC endpoint (or use ETH_RPC_URL env var)."
    }),
    token: Flags.string({
      description: "ERC20 symbol from env or token contract address."
    })
  };

  public override async run(): Promise<void> {
    const { args, flags } = await this.parse(Balance);
    await runBalanceCommand({
      box: args.box,
      passphrase: flags.passphrase,
      rpcUrl: flags["rpc-url"],
      token: flags.token
    });
  }
}
