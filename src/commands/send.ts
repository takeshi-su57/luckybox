import { Args, Command, Flags } from "@oclif/core";
import { runSendCommand } from "../cli/send";

export default class Send extends Command {
  static override summary = "Send native token or ERC20 from a derived alias.";

  static override args = {
    box: Args.string({
      required: true,
      description: "Address alias (box1, box2, ...)."
    })
  };

  static override flags = {
    amount: Flags.string({
      required: true,
      description: "Amount to send."
    }),
    passphrase: Flags.string({
      description: "Passphrase (or use BRAIN_PASSPHRASE env var)."
    }),
    "rpc-url": Flags.string({
      description: "RPC endpoint (or use ETH_RPC_URL env var)."
    }),
    to: Flags.string({
      required: true,
      description: "Recipient address."
    }),
    token: Flags.string({
      description: "ERC20 symbol from env or token contract address."
    })
  };

  public override async run(): Promise<void> {
    const { args, flags } = await this.parse(Send);
    await runSendCommand({
      amount: flags.amount,
      box: args.box,
      passphrase: flags.passphrase,
      rpcUrl: flags["rpc-url"],
      to: flags.to,
      token: flags.token
    });
  }
}
