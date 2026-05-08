import { createPublicClient, erc20Abi, formatEther, formatUnits, http, isAddress } from "viem";
import { getAddress } from "viem";
import { getChainByNetwork, SUPPORTED_NETWORKS, type SupportedNetwork } from "../config/chains";
import {
  addRpc,
  addToken,
  getNetworkLocalConfig,
  removeRpc,
  removeToken,
  type StoredToken
} from "../config/local-config";
import { resolveRpcUrl } from "../config/rpc";
import { copyToClipboard } from "../io/clipboard";
import { deriveWalletByBox, formatPartialAddress, indexToBox } from "../wallet/derive";
import { runSendCommand } from "../commands/send";

export type ShellDeps = {
  promptLine: (prompt: string) => Promise<string>;
  readPassphrase: (options?: { passphrase?: string; confirm?: boolean }) => Promise<string>;
  log: (line: string) => void;
};

type SessionToken =
  | { kind: "native"; symbol: string }
  | { kind: "erc20"; symbol: string; address: `0x${string}`; decimals: number };

type SessionContext = {
  passphrase: string;
  network: SupportedNetwork;
  rpcUrl: string;
  nativeSymbol: string;
  token: SessionToken;
  savedRpcs: string[];
  savedTokens: StoredToken[];
};

function parseShellInput(input: string): { command: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return null;
  return { command: tokens[0]!.toLowerCase(), args: tokens.slice(1) };
}

function readFlagValue(args: string[], names: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const token = args[i]!;
    if (names.includes(token)) {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) throw new Error(`Missing value for ${token}.`);
      return next;
    }
    for (const name of names) {
      const withEq = `${name}=`;
      if (token.startsWith(withEq)) {
        const value = token.slice(withEq.length);
        if (!value) throw new Error(`Missing value for ${name}.`);
        return value;
      }
    }
  }
  return undefined;
}

function hasFlag(args: string[], names: string[]): boolean {
  return args.some((arg) => names.includes(arg));
}

function parseBoxAlias(raw: string | undefined): string {
  if (!raw) throw new Error("Missing box alias. Example: box1");
  if (!/^box[1-9]\d*$/i.test(raw)) throw new Error(`Invalid box alias "${raw}".`);
  return raw.toLowerCase();
}

function parseListRange(args: string[]): { from: number; to: number; summary: boolean } {
  const fromRaw = readFlagValue(args, ["--from"]);
  const toRaw = readFlagValue(args, ["--to"]);
  const summary = hasFlag(args, ["--summary"]);

  const parse = (value: string, label: string): number => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`${label} must be a positive integer.`);
    }
    return parsed;
  };

  if (!fromRaw && !toRaw) return { from: 1, to: 5, summary };
  if (fromRaw && !toRaw) {
    const from = parse(fromRaw, "--from");
    return { from, to: from + 4, summary };
  }
  if (!fromRaw && toRaw) {
    const to = parse(toRaw, "--to");
    return { from: Math.max(1, to - 4), to, summary };
  }

  const from = parse(fromRaw!, "--from");
  const to = parse(toRaw!, "--to");
  if (to < from) throw new Error("--to must be greater than or equal to --from.");
  return { from, to, summary };
}

async function chooseNetwork(deps: ShellDeps): Promise<SupportedNetwork> {
  deps.log("Select network:");
  SUPPORTED_NETWORKS.forEach((network, index) => deps.log(`${index + 1}. ${network}`));
  const raw = (await deps.promptLine("Network number: ")).trim();
  const selected = Number.parseInt(raw, 10);
  const network = SUPPORTED_NETWORKS[selected - 1];
  if (!network) throw new Error("Invalid network selection.");
  return network;
}

async function chooseRpcUrl(
  deps: ShellDeps,
  network: SupportedNetwork,
  savedRpcs: string[]
): Promise<{ rpcUrl: string; savedRpcs: string[] }> {
  deps.log("RPC options:");
  deps.log("1. Use default/public RPC");
  savedRpcs.forEach((rpc, idx) => deps.log(`${idx + 2}. ${rpc}`));
  deps.log(`${savedRpcs.length + 2}. Other (add custom RPC)`);

  const picked = Number.parseInt((await deps.promptLine("RPC option number: ")).trim(), 10);
  if (!Number.isInteger(picked) || picked < 1 || picked > savedRpcs.length + 2) {
    throw new Error("Invalid RPC option.");
  }

  if (picked === 1) {
    return { rpcUrl: resolveRpcUrl(undefined, network), savedRpcs };
  }
  if (picked <= savedRpcs.length + 1) {
    return { rpcUrl: savedRpcs[picked - 2]!, savedRpcs };
  }

  const url = (await deps.promptLine("Custom RPC URL: ")).trim();
  if (!url) throw new Error("Custom RPC URL cannot be empty.");
  const updated = await addRpc(network, url);
  return { rpcUrl: url, savedRpcs: updated.rpcs };
}

async function chooseToken(
  deps: ShellDeps,
  network: SupportedNetwork,
  publicClient: ReturnType<typeof createPublicClient>,
  nativeSymbol: string,
  savedTokens: StoredToken[]
): Promise<{ token: SessionToken; savedTokens: StoredToken[] }> {
  deps.log("Select asset to check:");
  deps.log(`1. ${nativeSymbol}`);
  savedTokens.forEach((token, index) =>
    deps.log(`${index + 2}. ${token.symbol} (${token.address})`)
  );
  deps.log(`${savedTokens.length + 2}. Other`);
  const raw = (await deps.promptLine("Asset number: ")).trim();
  const picked = Number.parseInt(raw, 10);

  if (picked === 1) {
    return { token: { kind: "native", symbol: nativeSymbol }, savedTokens };
  }

  if (picked > 1 && picked <= savedTokens.length + 1) {
    const selected = savedTokens[picked - 2]!;
    return {
      token: {
        kind: "erc20",
        symbol: selected.symbol,
        address: getAddress(selected.address),
        decimals: Number.parseInt(selected.decimals, 10)
      },
      savedTokens
    };
  }

  const tokenAddressInput =
    picked === savedTokens.length + 2
      ? (await deps.promptLine("Token address: ")).trim()
      : (() => {
          throw new Error("Invalid asset selection.");
        })();

  if (!isAddress(tokenAddressInput, { strict: false })) {
    throw new Error(`Invalid token address: ${tokenAddressInput}`);
  }
  const tokenAddress = getAddress(tokenAddressInput);
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "symbol"
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals"
    })
  ]);
  const updated = await addToken(network, { address: tokenAddress, symbol, decimals });
  return {
    token: { kind: "erc20", symbol, decimals, address: tokenAddress },
    savedTokens: updated.tokens
  };
}

async function createSessionContext(deps: ShellDeps): Promise<SessionContext> {
  const passphrase = await deps.readPassphrase({ confirm: false });
  const network = await chooseNetwork(deps);
  process.env.VAULT_NETWORK = network;
  const localConfig = await getNetworkLocalConfig(network);
  const chain = getChainByNetwork(network);
  const nativeSymbol = chain.nativeCurrency.symbol || "ETH";
  const { rpcUrl, savedRpcs } = await chooseRpcUrl(deps, network, localConfig.rpcs);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const { token, savedTokens } = await chooseToken(
    deps,
    network,
    publicClient,
    nativeSymbol,
    localConfig.tokens
  );
  return { passphrase, network, rpcUrl, nativeSymbol, token, savedRpcs, savedTokens };
}

async function runListCommand(
  context: SessionContext,
  args: string[],
  log: (line: string) => void
): Promise<void> {
  const { from, to, summary } = parseListRange(args);
  const chain = getChainByNetwork(context.network);
  const publicClient = createPublicClient({ chain, transport: http(context.rpcUrl) });

  for (let index = from; index <= to; index++) {
    const box = indexToBox(index - 1);
    const wallet = deriveWalletByBox(context.passphrase, box);
    const nativeRaw = await publicClient.getBalance({ address: wallet.address });
    const nativeBalance = formatEther(nativeRaw);

    let tokenBalance: string;
    let tokenSymbol: string;
    if (context.token.kind === "erc20") {
      const raw = await publicClient.readContract({
        address: context.token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet.address]
      });
      tokenBalance = formatUnits(raw, context.token.decimals);
      tokenSymbol = context.token.symbol;
    } else {
      tokenBalance = nativeBalance;
      tokenSymbol = context.nativeSymbol;
    }

    if (summary) {
      log(
        `${box}, ${formatPartialAddress(wallet.address)}, ${nativeBalance} ${context.nativeSymbol}, ${tokenBalance} ${tokenSymbol}`
      );
    } else {
      log(`${box}, ${nativeBalance} ${context.nativeSymbol}, ${tokenBalance} ${tokenSymbol}`);
    }
  }
}

async function runPickCommand(
  context: SessionContext,
  args: string[],
  log: (line: string) => void
): Promise<void> {
  const box = parseBoxAlias(args[0]);
  const copy = hasFlag(args, ["--copy-address"]);
  const short = hasFlag(args, ["--short-address"]);
  const full = hasFlag(args, ["--full-address"]);
  const selectedModes = [copy, short, full].filter(Boolean).length;
  if (selectedModes !== 1) {
    throw new Error(
      "pick requires exactly one option: --copy-address | --short-address | --full-address"
    );
  }

  const wallet = deriveWalletByBox(context.passphrase, box);
  if (copy) {
    const copied = copyToClipboard(wallet.address);
    if (!copied) throw new Error("Failed to copy address to clipboard on this system.");
    log(`${box}: address copied.`);
    return;
  }
  if (short) {
    log(`${box}: ${formatPartialAddress(wallet.address)}`);
    return;
  }
  log(`${box}: ${wallet.address}`);
}

async function runSendLoopCommand(context: SessionContext, args: string[]): Promise<void> {
  const box = parseBoxAlias(args[0]);
  const mode = args[1]?.toLowerCase();
  const to = readFlagValue(args, ["--to"]) ?? "";
  const amount = readFlagValue(args, ["--amount"]) ?? "";
  if (mode !== "native" && mode !== "token") {
    throw new Error('send mode must be "native" or "token".');
  }
  if (mode === "token" && context.token.kind !== "erc20") {
    throw new Error('send mode "token" requires an ERC20 token selection from shell setup.');
  }

  await runSendCommand({
    box,
    to,
    amount,
    token:
      mode === "token"
        ? context.token.kind === "erc20"
          ? context.token.address
          : undefined
        : undefined,
    passphrase: context.passphrase,
    rpcUrl: context.rpcUrl
  });
}

export async function executeShellSession(deps: ShellDeps): Promise<void> {
  const context = await createSessionContext(deps);
  deps.log('Shell unlocked. Type "help" for commands, "exit" to quit.');

  try {
    while (true) {
      const raw = await deps.promptLine("vault> ");
      const parsed = parseShellInput(raw);
      if (!parsed) continue;
      const { command, args } = parsed;

      if (command === "exit" || command === "quit") {
        deps.log("Session closed.");
        return;
      }
      if (command === "help") {
        deps.log("Commands:");
        deps.log("  list [--from N] [--to N] [--summary]");
        deps.log("  pick boxN --copy-address | --short-address | --full-address");
        deps.log("  send boxN native --to 0x... --amount <decimal>");
        deps.log("  send boxN token --to 0x... --amount <decimal>");
        deps.log("  rpc list | rpc add <url> | rpc remove <index|url>");
        deps.log("  token list | token add <address> | token remove <index|address|symbol>");
        deps.log("  help");
        deps.log("  exit");
        continue;
      }

      try {
        if (command === "list") {
          await runListCommand(context, args, deps.log);
          continue;
        }
        if (command === "pick") {
          await runPickCommand(context, args, deps.log);
          continue;
        }
        if (command === "send") {
          await runSendLoopCommand(context, args);
          continue;
        }
        if (command === "rpc") {
          const action = (args[0] ?? "").toLowerCase();
          if (action === "list") {
            if (context.savedRpcs.length === 0) deps.log("No saved RPCs.");
            context.savedRpcs.forEach((rpc, idx) => deps.log(`${idx + 1}. ${rpc}`));
            continue;
          }
          if (action === "add") {
            const url = args[1];
            if (!url) throw new Error("Usage: rpc add <url>");
            const updated = await addRpc(context.network, url);
            context.savedRpcs = updated.rpcs;
            deps.log("RPC saved.");
            continue;
          }
          if (action === "remove") {
            const selector = args[1];
            if (!selector) throw new Error("Usage: rpc remove <index|url>");
            const updated = await removeRpc(context.network, selector);
            context.savedRpcs = updated.rpcs;
            deps.log("RPC removed if matched.");
            continue;
          }
          throw new Error("Usage: rpc list | rpc add <url> | rpc remove <index|url>");
        }
        if (command === "token") {
          const action = (args[0] ?? "").toLowerCase();
          if (action === "list") {
            if (context.savedTokens.length === 0) deps.log("No saved tokens.");
            context.savedTokens.forEach((token, idx) =>
              deps.log(`${idx + 1}. ${token.symbol} (${token.address}) decimals=${token.decimals}`)
            );
            continue;
          }
          if (action === "add") {
            const address = args[1];
            if (!address) throw new Error("Usage: token add <address>");
            const chain = getChainByNetwork(context.network);
            const client = createPublicClient({ chain, transport: http(context.rpcUrl) });
            if (!isAddress(address, { strict: false }))
              throw new Error(`Invalid token address: ${address}`);
            const tokenAddress = getAddress(address);
            const [symbol, decimals] = await Promise.all([
              client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
              client.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "decimals"
              })
            ]);
            const updated = await addToken(context.network, {
              address: tokenAddress,
              symbol,
              decimals
            });
            context.savedTokens = updated.tokens;
            deps.log("Token saved.");
            continue;
          }
          if (action === "remove") {
            const selector = args[1];
            if (!selector) throw new Error("Usage: token remove <index|address|symbol>");
            const updated = await removeToken(context.network, selector);
            context.savedTokens = updated.tokens;
            deps.log("Token removed if matched.");
            continue;
          }
          throw new Error(
            "Usage: token list | token add <address> | token remove <index|address|symbol>"
          );
        }
        deps.log(`Unknown command: ${command}. Type "help".`);
      } catch (error) {
        deps.log(error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    context.passphrase = "";
  }
}
