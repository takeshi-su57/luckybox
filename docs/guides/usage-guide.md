# Usage Guide

## Overview

`luckybox` is a deterministic EVM wallet CLI.  
Given the same passphrase and salt, it always derives the same addresses.

## Core Environment Variables

- `BRAIN_WALLET_SALT` (optional override; otherwise stored in `config.json` and prompted on first use)
- `BRAIN_PASSPHRASE` (optional override for tests; otherwise prompted)

Optional advanced env overrides:

- `VAULT_NETWORK` (`ethereum`, `arbitrum`, `sepolia`, `base`, `polygon`) for non-shell commands
- `VAULT_ERC20_TOKENS` (format: `SYMBOL:0xAddress[,SYMBOL:0xAddress]`) for symbol-based non-shell token lookup

## Recommended Shell Workflow

Start shell:

```bash
pnpm run luckybox -- shell
```

Setup inside shell:

1. enter passphrase (hidden)
2. pick network
3. pick default/saved/other RPC (default uses network-aware public endpoint)
4. pick native/saved/other token

Loop commands:

```text
list [--from N] [--to N] [--summary]
pick boxN --copy-address | --short-address | --full-address
send boxN native --to 0x... --amount <decimal>
send boxN token --to 0x... --amount <decimal>
rpc list | rpc add <url> | rpc remove <index|url>
token list | token add <address> | token remove <index|address|symbol>
help
exit
```

## Non-Shell Commands

Show help:

```bash
pnpm run luckybox -- --help
```

Show one address:

```bash
pnpm run luckybox -- address box1 --passphrase "your passphrase"
```

List default wallets:

```bash
pnpm run luckybox -- list --passphrase "your passphrase"
```

Check native balance:

```bash
pnpm run luckybox -- balance box1 --passphrase "your passphrase"
```

Check ERC20 balance:

```bash
pnpm run luckybox -- balance box1 --token USDT --passphrase "your passphrase"
```

Send native token:

```bash
pnpm run luckybox -- send box1 --to 0xRecipient --amount 0.001 --passphrase "your passphrase"
```

Send ERC20:

```bash
pnpm run luckybox -- send box1 --to 0xRecipient --token USDT --amount 1 --passphrase "your passphrase"
```

## Persistent Local Config

The app saves reusable non-sensitive setup into `config.json`, scoped by network:

```json
{
  "sepolia": {
    "rpcs": ["https://..."],
    "tokens": [{ "address": "0x...", "symbol": "USDT", "decimals": "6" }]
  }
}
```

Sensitive values are never persisted there.

Global wallet salt is persisted under `_global.walletSalt`. Manage it via:

```bash
pnpm run luckybox -- salt get
pnpm run luckybox -- salt set
pnpm run luckybox -- salt clear
```

## Safety Behavior

- `send` requires confirmation (`type "send"`).
- Network mismatch is blocked by chain-id validation.
- Amount must be non-empty and positive.

## Troubleshooting

- `Unsupported VAULT_NETWORK`: verify `VAULT_NETWORK`.
- `Missing RPC URL`: pass `--rpc-url`.
- ERC20 errors: verify token address and token behavior on selected chain.
- Shell setup errors: verify network/RPC/token selection and that RPC endpoint is reachable.
