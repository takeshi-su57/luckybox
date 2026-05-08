import { config as loadDotEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  parseEther,
  parseUnits
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import process from "node:process";
import { runSendCommand } from "../../src/commands/send";
import { deriveWalletByBoxWithSalt } from "../../src/wallet/derive";
import { resolveErc20Address } from "../../src/config/env";
import {
  getTestTokenSymbol,
  hasConfiguredTokenSymbol,
  hasEnv,
  requireEnv
} from "../testnet/helpers";

loadDotEnv({ path: process.env.TEST_ENV_FILE || ".env.testnet", override: false, quiet: true });

vi.mock("../../src/io/prompt", async () => {
  const actual = await vi.importActual<typeof import("../../src/io/prompt")>("../../src/io/prompt");
  return {
    ...actual,
    promptLine: vi.fn(async () => "send"),
    readPassphrase: vi.fn(async (options?: { passphrase?: string }) => {
      return options?.passphrase ?? process.env.BRAIN_PASSPHRASE ?? "";
    })
  };
});

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function envNumber(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

async function waitForFinalBalances(options: {
  publicClient: ReturnType<typeof createPublicClient>;
  wallet0Address: `0x${string}`;
  tokenAddress: `0x${string}`;
  ethReserveWei: bigint;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<{ eth: bigint; token: bigint }> {
  const {
    publicClient,
    wallet0Address,
    tokenAddress,
    ethReserveWei,
    maxAttempts = 30,
    delayMs = 2_000
  } = options;

  let lastEth = 0n;
  let lastToken = 0n;
  for (let i = 0; i < maxAttempts; i++) {
    const [eth, token] = await Promise.all([
      publicClient.getBalance({ address: wallet0Address }),
      publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet0Address]
      })
    ]);
    lastEth = eth;
    lastToken = token;
    if (eth <= ethReserveWei && token === 0n) {
      return { eth, token };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { eth: lastEth, token: lastToken };
}

async function runCliSendAndWait(options: {
  publicClient: ReturnType<typeof createPublicClient>;
  runOptions: {
    box: string;
    to: `0x${string}`;
    amount: string;
    token?: string;
    passphrase: string;
    rpcUrl?: string;
  };
}): Promise<`0x${string}`> {
  const { publicClient, runOptions } = options;
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
    originalLog(...args);
  };

  try {
    await runSendCommand({
      ...runOptions,
      rpcUrl: runOptions.rpcUrl ?? requireEnv("ETH_RPC_URL")
    });
  } finally {
    console.log = originalLog;
  }

  const sentLine = [...logs].reverse().find((line) => line.startsWith("Sent: 0x"));
  if (!sentLine) {
    throw new Error(`Missing Sent hash for ${runOptions.box} -> ${runOptions.to}`);
  }

  const hash = sentLine.replace("Sent: ", "").trim() as `0x${string}`;
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function sweepTokenBalanceToExternal(options: {
  publicClient: ReturnType<typeof createPublicClient>;
  wallet0Address: `0x${string}`;
  tokenAddress: `0x${string}`;
  tokenSymbol: string;
  passphrase: string;
  externalAddress: `0x${string}`;
  decimals: number;
  maxSweeps?: number;
}): Promise<{ swept: boolean; reason?: string }> {
  const {
    publicClient,
    wallet0Address,
    tokenAddress,
    tokenSymbol,
    passphrase,
    externalAddress,
    decimals,
    maxSweeps = 4
  } = options;

  for (let i = 0; i < maxSweeps; i++) {
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet0Address]
    });
    if (balance === 0n) return { swept: true };

    const preflight = await checkTokenTransferPossible({
      publicClient,
      tokenAddress,
      from: wallet0Address,
      to: externalAddress,
      amount: balance,
      tokenSymbol,
      senderLabel: "box1",
      recipientLabel: "external"
    });
    if (!preflight.ok) {
      return { swept: false, reason: preflight.reason };
    }

    await runCliSendAndWait({
      publicClient,
      runOptions: {
        box: "box1",
        to: externalAddress,
        amount: formatUnits(balance, decimals),
        token: tokenSymbol,
        passphrase
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  return { swept: false, reason: "Token balance did not reach zero within sweep retries." };
}

async function getSafeNativeReturnAmount(options: {
  publicClient: ReturnType<typeof createPublicClient>;
  address: `0x${string}`;
  desiredWei: bigint;
}): Promise<bigint> {
  const { publicClient, address, desiredWei } = options;
  const [balance, feePreview] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.estimateFeesPerGas({ chain: sepolia, type: "eip1559" })
  ]);

  const maxFeePerGas = feePreview.maxFeePerGas ?? 0n;
  const gasLimit = 21_000n;
  const txFeeBuffer = maxFeePerGas * gasLimit;
  const safetyBuffer = txFeeBuffer + parseEther("0.00001");

  if (balance <= safetyBuffer) {
    return 0n;
  }

  const maxSendable = balance - safetyBuffer;
  return maxSendable < desiredWei ? maxSendable : desiredWei;
}

async function checkTokenTransferPossible(options: {
  publicClient: ReturnType<typeof createPublicClient>;
  tokenAddress: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  tokenSymbol: string;
  senderLabel: string;
  recipientLabel: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { publicClient, tokenAddress, from, to, amount, tokenSymbol, senderLabel, recipientLabel } =
    options;
  const [senderBalance, recipientBalance, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [from]
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [to]
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals"
    })
  ]);

  try {
    await publicClient.simulateContract({
      account: from,
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount]
    });
    return { ok: true };
  } catch (error) {
    const requested = formatUnits(amount, decimals);
    const sender = formatUnits(senderBalance, decimals);
    const recipient = formatUnits(recipientBalance, decimals);
    return {
      ok: false,
      reason:
        `Token preflight failed for ${tokenSymbol} transfer ${senderLabel}->${recipientLabel}. ` +
        `requested=${requested}, senderBalance=${sender}, recipientBalance=${recipient}. ` +
        `Underlying error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

const scenarioReady =
  process.env.TEST_ENABLE_E2E === "true" &&
  process.env.TESTNET_ALLOW_VALUE_TRANSFER === "true" &&
  hasEnv("ETH_RPC_URL") &&
  hasEnv("BRAIN_WALLET_SALT") &&
  hasEnv("BRAIN_PASSPHRASE") &&
  hasConfiguredTokenSymbol(getTestTokenSymbol()) &&
  hasEnv("TEST_EXTERNAL_PRIVATE_KEY") &&
  hasEnv("TEST_EXTERNAL_ADDRESS");

const maybeDescribe = scenarioReady ? describe : describe.skip;

beforeEach(() => {
  restoreEnv();
  process.env.VAULT_NETWORK = "sepolia";
});

maybeDescribe("Sepolia full scenario e2e", () => {
  it("prefunds wallet0, performs multi-wallet ETH+USDT flow, and returns funds to external tester", async () => {
    const rpcUrl = requireEnv("ETH_RPC_URL");
    const passphrase = requireEnv("BRAIN_PASSPHRASE");
    const externalPrivateKey = requireEnv("TEST_EXTERNAL_PRIVATE_KEY") as `0x${string}`;
    const externalAddress = getAddress(requireEnv("TEST_EXTERNAL_ADDRESS"));
    const tokenSymbol = getTestTokenSymbol();
    const tokenAddress = resolveErc20Address(tokenSymbol);
    const ethPrefund = envNumber("TEST_ETH_PREFUND", "0.01");
    const usdtPrefund = envNumber("TEST_USDT_PREFUND", "10");
    const ethDistributeEach = envNumber("TEST_ETH_DISTRIBUTE_EACH", "0.002");
    const ethReturnEach = envNumber("TEST_ETH_RETURN_EACH", "0.001");
    const usdtDistributeEach = envNumber("TEST_USDT_DISTRIBUTE_EACH", "2");
    const usdtReturnEach = envNumber("TEST_USDT_RETURN_EACH", "1");
    const ethFinalReserve = envNumber("TEST_ETH_FINAL_RESERVE", "0.0005");

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl)
    });

    const externalAccount = privateKeyToAccount(externalPrivateKey);
    expect(getAddress(externalAccount.address)).toBe(externalAddress);
    const externalWalletClient = createWalletClient({
      account: externalAccount,
      chain: sepolia,
      transport: http(rpcUrl)
    });

    const salt = process.env.BRAIN_WALLET_SALT ?? "brainvault:v1:ethereum";
    const wallet0 = deriveWalletByBoxWithSalt(passphrase, salt, "box1");
    const wallet1 = deriveWalletByBoxWithSalt(passphrase, salt, "box2");
    const wallet2 = deriveWalletByBoxWithSalt(passphrase, salt, "box3");

    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals"
    });

    const prefundEthWei = parseEther(ethPrefund);
    const prefundToken = parseTokenAmount(usdtPrefund, decimals);

    const fundNativeHash = await externalWalletClient.sendTransaction({
      to: wallet0.address,
      value: prefundEthWei
    });
    await publicClient.waitForTransactionReceipt({ hash: fundNativeHash });

    const fundTokenHash = await externalWalletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [wallet0.address, prefundToken]
    });
    await publicClient.waitForTransactionReceipt({ hash: fundTokenHash });

    await runCliSendAndWait({
      publicClient,
      runOptions: {
        box: "box1",
        to: wallet1.address,
        amount: ethDistributeEach,
        passphrase
      }
    });
    await runCliSendAndWait({
      publicClient,
      runOptions: {
        box: "box1",
        to: wallet2.address,
        amount: ethDistributeEach,
        passphrase
      }
    });

    await runCliSendAndWait({
      publicClient,
      runOptions: {
        box: "box1",
        to: wallet1.address,
        amount: usdtDistributeEach,
        token: tokenSymbol,
        passphrase
      }
    });
    await runCliSendAndWait({
      publicClient,
      runOptions: {
        box: "box1",
        to: wallet2.address,
        amount: usdtDistributeEach,
        token: tokenSymbol,
        passphrase
      }
    });

    const desiredEthReturnWei = parseEther(ethReturnEach);
    const box2SafeReturnWei = await getSafeNativeReturnAmount({
      publicClient,
      address: wallet1.address,
      desiredWei: desiredEthReturnWei
    });
    const box3SafeReturnWei = await getSafeNativeReturnAmount({
      publicClient,
      address: wallet2.address,
      desiredWei: desiredEthReturnWei
    });

    expect(box2SafeReturnWei > 0n).toBe(true);
    expect(box3SafeReturnWei > 0n).toBe(true);

    await runCliSendAndWait({
      publicClient,
      runOptions: {
        box: "box2",
        to: wallet0.address,
        amount: formatUnits(box2SafeReturnWei, 18),
        passphrase
      }
    });
    await runCliSendAndWait({
      publicClient,
      runOptions: {
        box: "box3",
        to: wallet0.address,
        amount: formatUnits(box3SafeReturnWei, 18),
        passphrase
      }
    });

    const box2TokenReturnCheck = await checkTokenTransferPossible({
      publicClient,
      tokenAddress,
      from: wallet1.address,
      to: wallet0.address,
      amount: parseTokenAmount(usdtReturnEach, decimals),
      tokenSymbol,
      senderLabel: "box2",
      recipientLabel: "box1"
    });
    const box3TokenReturnCheck = await checkTokenTransferPossible({
      publicClient,
      tokenAddress,
      from: wallet2.address,
      to: wallet0.address,
      amount: parseTokenAmount(usdtReturnEach, decimals),
      tokenSymbol,
      senderLabel: "box3",
      recipientLabel: "box1"
    });

    if (box2TokenReturnCheck.ok && box3TokenReturnCheck.ok) {
      await runCliSendAndWait({
        publicClient,
        runOptions: {
          box: "box2",
          to: wallet0.address,
          amount: usdtReturnEach,
          token: tokenSymbol,
          passphrase
        }
      });
      await runCliSendAndWait({
        publicClient,
        runOptions: {
          box: "box3",
          to: wallet0.address,
          amount: usdtReturnEach,
          token: tokenSymbol,
          passphrase
        }
      });
    } else {
      console.warn(
        "[e2e scenario] Skipping token return leg due to token transfer restrictions.",
        box2TokenReturnCheck.ok ? "" : box2TokenReturnCheck.reason,
        box3TokenReturnCheck.ok ? "" : box3TokenReturnCheck.reason
      );
    }

    const tokenSweep = await sweepTokenBalanceToExternal({
      publicClient,
      wallet0Address: wallet0.address,
      tokenAddress,
      tokenSymbol,
      passphrase,
      externalAddress,
      decimals
    });
    if (!tokenSweep.swept) {
      console.warn(
        "[e2e scenario] Token sweep to external was skipped/partial.",
        tokenSweep.reason
      );
    }

    const wallet0EthBalance = await publicClient.getBalance({ address: wallet0.address });
    const reserveWei = parseEther(ethFinalReserve);
    if (wallet0EthBalance > reserveWei) {
      const sendWei = wallet0EthBalance - reserveWei;
      const sendAmount = formatUnits(sendWei, 18);
      await runCliSendAndWait({
        publicClient,
        runOptions: {
          box: "box1",
          to: externalAddress,
          amount: sendAmount,
          passphrase
        }
      });
    }

    const { eth: postWallet0Eth, token: postWallet0Token } = await waitForFinalBalances({
      publicClient,
      wallet0Address: wallet0.address,
      tokenAddress,
      ethReserveWei: parseEther(ethFinalReserve)
    });
    expect(postWallet0Eth <= parseEther(ethFinalReserve)).toBe(true);
    if (tokenSweep.swept) {
      expect(postWallet0Token).toBe(0n);
    }
  }, 240_000);
});
