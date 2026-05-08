import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sendMock,
  copyMock,
  deriveMock,
  indexToBoxMock,
  clientMock,
  getChainMock,
  resolveRpcUrlMock,
  getNetworkLocalConfigMock,
  addRpcMock,
  addTokenMock,
  removeRpcMock,
  removeTokenMock
} = vi.hoisted(() => {
  const emptyLocalConfig = () => ({
    rpcs: [] as string[],
    tokens: [] as Array<{ address: string; symbol: string; decimals: string }>
  });
  const sendMock = vi.fn();
  const copyMock = vi.fn(() => true);
  const deriveMock = vi.fn((passphrase: string, box: string) => ({
    box,
    address:
      box === "box1"
        ? "0x1111111111111111111111111111111111111111"
        : "0x2222222222222222222222222222222222222222",
    account: { address: "0x1111111111111111111111111111111111111111" }
  }));
  const indexToBoxMock = vi.fn((index: number) => `box${index + 1}`);
  const clientMock = {
    getBalance: vi.fn(async () => 1_000_000_000_000_000_000n),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "symbol") return "USDT";
      if (functionName === "decimals") return 6;
      return 12_000_000n;
    })
  };
  const getChainMock = vi.fn(() => ({
    nativeCurrency: { symbol: "ETH" }
  }));
  const resolveRpcUrlMock = vi.fn((override?: string, network?: string) => {
    if (override) return override;
    if (network) return `https://${network}.rpc.test`;
    return "https://env.rpc.test";
  });
  const getNetworkLocalConfigMock = vi.fn(async () => emptyLocalConfig());
  const addRpcMock = vi.fn(async () => emptyLocalConfig());
  const addTokenMock = vi.fn(async () => emptyLocalConfig());
  const removeRpcMock = vi.fn(async () => emptyLocalConfig());
  const removeTokenMock = vi.fn(async () => emptyLocalConfig());
  return {
    sendMock,
    copyMock,
    deriveMock,
    indexToBoxMock,
    clientMock,
    getChainMock,
    resolveRpcUrlMock,
    getNetworkLocalConfigMock,
    addRpcMock,
    addTokenMock,
    removeRpcMock,
    removeTokenMock
  };
});

vi.mock("../src/commands/send", () => ({
  runSendCommand: sendMock
}));
vi.mock("../src/io/clipboard", () => ({
  copyToClipboard: copyMock
}));
vi.mock("../src/wallet/derive", () => ({
  deriveWalletByBox: deriveMock,
  formatPartialAddress: (v: string) => `${v.slice(0, 5)}...${v.slice(-5)}`,
  indexToBox: indexToBoxMock
}));
vi.mock("../src/config/chains", () => ({
  SUPPORTED_NETWORKS: ["ethereum", "sepolia"],
  getChainByNetwork: getChainMock
}));
vi.mock("viem", () => ({
  createPublicClient: () => clientMock,
  erc20Abi: [],
  formatEther: () => "1",
  formatUnits: () => "12",
  getAddress: (v: string) => v,
  http: () => ({}),
  isAddress: () => true
}));
vi.mock("../src/config/rpc", () => ({
  resolveRpcUrl: resolveRpcUrlMock
}));
vi.mock("../src/config/local-config", () => ({
  getNetworkLocalConfig: getNetworkLocalConfigMock,
  addRpc: addRpcMock,
  addToken: addTokenMock,
  removeRpc: removeRpcMock,
  removeToken: removeTokenMock
}));

import { executeShellSession } from "../src/app/shell";

const originalVaultNetwork = process.env.VAULT_NETWORK;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAULT_NETWORK = originalVaultNetwork;
});

describe("interactive shell", () => {
  it("prompts passphrase once and executes help/list/pick/send/exit", async () => {
    const prompts = [
      "2", // network
      "1", // rpc option default
      "2", // token choice "other"
      "0x9999999999999999999999999999999999999999", // token address
      "help",
      "list --summary",
      "pick box1 --short-address",
      "send box1 native --to 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --amount 1",
      "exit"
    ];
    let i = 0;
    const logs: string[] = [];
    const readPassphrase = vi.fn(async () => "secret");

    await executeShellSession({
      readPassphrase,
      promptLine: async () => prompts[i++] ?? "exit",
      log: (line) => logs.push(line)
    });

    expect(readPassphrase).toHaveBeenCalledTimes(1);
    expect(logs.some((line) => line.startsWith("Commands:"))).toBe(true);
    expect(logs.some((line) => line.startsWith("box1,"))).toBe(true);
    expect(logs.some((line) => line.includes("..."))).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        box: "box1",
        to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        amount: "1",
        passphrase: "secret"
      })
    );
    expect(addTokenMock).toHaveBeenCalled();
    expect(resolveRpcUrlMock).toHaveBeenCalledWith(undefined, "sepolia");
  });

  it("rejects token send when setup asset is native", async () => {
    const prompts = [
      "2", // network
      "1", // rpc option default
      "1", // token choice native
      "send box1 token --to 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --amount 1",
      "exit"
    ];
    let i = 0;
    const logs: string[] = [];
    const readPassphrase = vi.fn(async () => "secret");

    await executeShellSession({
      readPassphrase,
      promptLine: async () => prompts[i++] ?? "exit",
      log: (line) => logs.push(line)
    });

    expect(sendMock).not.toHaveBeenCalled();
    expect(
      logs.some((line) => line.includes('send mode "token" requires an ERC20 token selection'))
    ).toBe(true);
  });

  it("propagates selected network to send flow when using saved RPC option", async () => {
    getNetworkLocalConfigMock.mockResolvedValueOnce({
      rpcs: ["https://saved-rpc.example"],
      tokens: []
    });
    process.env.VAULT_NETWORK = "ethereum";
    let networkAtSend: string | undefined;
    sendMock.mockImplementationOnce(async () => {
      networkAtSend = process.env.VAULT_NETWORK;
    });

    const prompts = [
      "2", // network sepolia
      "2", // rpc option saved
      "1", // token choice native
      "send box1 native --to 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --amount 1",
      "exit"
    ];
    let i = 0;

    await executeShellSession({
      readPassphrase: async () => "secret",
      promptLine: async () => prompts[i++] ?? "exit",
      log: () => undefined
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(networkAtSend).toBe("sepolia");
  });

  it("uses network default RPC for option 1 even when ETH_RPC_URL points elsewhere", async () => {
    process.env.ETH_RPC_URL = "https://sepolia-env.rpc.test";
    const prompts = [
      "1", // network ethereum
      "1", // rpc option default
      "1", // token choice native
      "send box1 native --to 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --amount 1",
      "exit"
    ];
    let i = 0;

    await executeShellSession({
      readPassphrase: async () => "secret",
      promptLine: async () => prompts[i++] ?? "exit",
      log: () => undefined
    });

    expect(resolveRpcUrlMock).toHaveBeenCalledWith(undefined, "ethereum");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ rpcUrl: "https://ethereum.rpc.test" })
    );
  });
});
