import { promises as fs } from "node:fs";
import path from "node:path";
import { getAddress, isAddress } from "viem";
import type { SupportedNetwork } from "./chains";

export type StoredToken = {
  address: string;
  symbol: string;
  decimals: string;
};

export type GlobalLocalConfig = {
  walletSalt?: string;
};

export type NetworkLocalConfig = {
  rpcs: string[];
  tokens: StoredToken[];
};

export type LocalConfigFile = Record<string, NetworkLocalConfig> & { _global?: GlobalLocalConfig };

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

function emptyNetworkConfig(): NetworkLocalConfig {
  return { rpcs: [], tokens: [] };
}

function sanitizeGlobalConfig(raw: unknown): GlobalLocalConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as Partial<GlobalLocalConfig>;
  if (typeof candidate.walletSalt !== "string") return undefined;
  const trimmed = candidate.walletSalt.trim();
  if (trimmed.length === 0) return undefined;
  return { walletSalt: trimmed };
}

function sanitizeNetworkConfig(raw: unknown): NetworkLocalConfig {
  if (!raw || typeof raw !== "object") return emptyNetworkConfig();
  const candidate = raw as Partial<NetworkLocalConfig>;
  const rpcs = Array.isArray(candidate.rpcs)
    ? candidate.rpcs.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    : [];
  const tokens = Array.isArray(candidate.tokens)
    ? candidate.tokens
        .filter((value): value is StoredToken => {
          if (!value || typeof value !== "object") return false;
          const token = value as Partial<StoredToken>;
          return (
            typeof token.address === "string" &&
            typeof token.symbol === "string" &&
            typeof token.decimals === "string" &&
            token.address.trim().length > 0 &&
            token.symbol.trim().length > 0 &&
            token.decimals.trim().length > 0
          );
        })
        .map((token) => ({
          address: token.address.trim(),
          symbol: token.symbol.trim(),
          decimals: token.decimals.trim()
        }))
    : [];
  return { rpcs, tokens };
}

export async function loadLocalConfig(): Promise<LocalConfigFile> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: LocalConfigFile = {};
    for (const [network, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (network === "_global") {
        const global = sanitizeGlobalConfig(value);
        if (global) out._global = global;
        continue;
      }
      out[network] = sanitizeNetworkConfig(value);
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveLocalConfig(config: LocalConfigFile): Promise<void> {
  const tmp = `${CONFIG_PATH}.tmp`;
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(tmp, `${content}\n`, "utf8");
  await fs.rename(tmp, CONFIG_PATH);
}

export async function getNetworkLocalConfig(
  network: SupportedNetwork
): Promise<NetworkLocalConfig> {
  const file = await loadLocalConfig();
  return file[network] ? sanitizeNetworkConfig(file[network]) : emptyNetworkConfig();
}

export async function getGlobalWalletSalt(): Promise<string | undefined> {
  const file = await loadLocalConfig();
  return file._global?.walletSalt;
}

export async function setGlobalWalletSalt(value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error("Wallet salt cannot be blank.");
  const file = await loadLocalConfig();
  file._global = { ...(file._global ?? {}), walletSalt: trimmed };
  await saveLocalConfig(file);
}

export async function clearGlobalWalletSalt(): Promise<void> {
  const file = await loadLocalConfig();
  if (file._global) {
    delete file._global.walletSalt;
    if (Object.keys(file._global).length === 0) {
      delete file._global;
    }
    await saveLocalConfig(file);
  }
}

async function updateNetworkConfig(
  network: SupportedNetwork,
  updater: (config: NetworkLocalConfig) => NetworkLocalConfig
): Promise<NetworkLocalConfig> {
  const file = await loadLocalConfig();
  const current = file[network] ? sanitizeNetworkConfig(file[network]) : emptyNetworkConfig();
  const next = updater(current);
  file[network] = next;
  await saveLocalConfig(file);
  return next;
}

export async function addRpc(
  network: SupportedNetwork,
  rpcUrl: string
): Promise<NetworkLocalConfig> {
  const normalized = rpcUrl.trim();
  if (!normalized) throw new Error("RPC URL cannot be empty.");
  return await updateNetworkConfig(network, (config) => {
    const exists = config.rpcs.some((rpc) => rpc.toLowerCase() === normalized.toLowerCase());
    if (exists) return config;
    return { ...config, rpcs: [...config.rpcs, normalized].slice(-20) };
  });
}

export async function removeRpc(
  network: SupportedNetwork,
  selector: string
): Promise<NetworkLocalConfig> {
  const trimmed = selector.trim();
  return await updateNetworkConfig(network, (config) => {
    const asIndex = Number.parseInt(trimmed, 10);
    if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= config.rpcs.length) {
      return { ...config, rpcs: config.rpcs.filter((_, idx) => idx !== asIndex - 1) };
    }
    return {
      ...config,
      rpcs: config.rpcs.filter((rpc) => rpc.toLowerCase() !== trimmed.toLowerCase())
    };
  });
}

export async function addToken(
  network: SupportedNetwork,
  token: { address: string; symbol: string; decimals: number | string }
): Promise<NetworkLocalConfig> {
  if (!isAddress(token.address, { strict: false })) {
    throw new Error(`Invalid token address: ${token.address}`);
  }
  const normalizedAddress = getAddress(token.address);
  const normalizedSymbol = token.symbol.trim().toUpperCase();
  const decimals = String(token.decimals).trim();
  if (!normalizedSymbol) throw new Error("Token symbol cannot be empty.");
  if (!/^\d+$/.test(decimals)) throw new Error("Token decimals must be a numeric string.");

  return await updateNetworkConfig(network, (config) => {
    const exists = config.tokens.some(
      (item) => getAddress(item.address).toLowerCase() === normalizedAddress.toLowerCase()
    );
    if (exists) return config;
    return {
      ...config,
      tokens: [
        ...config.tokens,
        { address: normalizedAddress, symbol: normalizedSymbol, decimals }
      ].slice(-50)
    };
  });
}

export async function removeToken(
  network: SupportedNetwork,
  selector: string
): Promise<NetworkLocalConfig> {
  const trimmed = selector.trim();
  return await updateNetworkConfig(network, (config) => {
    const asIndex = Number.parseInt(trimmed, 10);
    if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= config.tokens.length) {
      return { ...config, tokens: config.tokens.filter((_, idx) => idx !== asIndex - 1) };
    }
    if (isAddress(trimmed, { strict: false })) {
      const target = getAddress(trimmed).toLowerCase();
      return {
        ...config,
        tokens: config.tokens.filter((item) => getAddress(item.address).toLowerCase() !== target)
      };
    }
    return {
      ...config,
      tokens: config.tokens.filter((item) => item.symbol.toLowerCase() !== trimmed.toLowerCase())
    };
  });
}
