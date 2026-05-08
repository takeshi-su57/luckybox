# luckybox

Deterministic key-derivation CLI for EVM addresses.

Recovery standard:

- `Luckybox Deterministic Key Standard v1`
- Spec: `docs/standards/deterministic-key-standard-v1.md`
- Test plan: `docs/testing/deterministic-key-test-plan.md`

## Scripts

- `pnpm run dev` (watch build + Node watch runtime)
- `pnpm run luckybox -- --help`
- `pnpm test`
- `pnpm run test:integration`
- `pnpm run test:e2e`
- `pnpm run test:e2e:scenario`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run format:check`

## Install

```bash
npm install -g luckybox
luckybox --help
```

Migration note:

- The legacy `vault` command name was removed. Use `luckybox` (global install) or `pnpm run luckybox -- ...` (repo-local).

## Interactive Shell

Run shell mode:

```bash
pnpm run luckybox -- shell
```

Shell setup flow:

1. hidden passphrase prompt
2. network selection
3. RPC selection (default/saved/other, default is network-aware public RPC)
4. asset selection (native/saved token/other)

Loop commands:

- `list [--from N] [--to N] [--summary]`
- `pick boxN --copy-address | --short-address | --full-address`
- `send boxN native --to 0x... --amount <decimal>`
- `send boxN token --to 0x... --amount <decimal>`
- `rpc list | rpc add <url> | rpc remove <index|url>`
- `token list | token add <address> | token remove <index|address|symbol>`
- `help`
- `exit`

Passphrase input notes:

- Default is a hidden prompt (fails closed if hidden prompt is unavailable).
- For automation/tests prefer `--passphrase-stdin` or `--passphrase-file`.
- `--passphrase` and `BRAIN_PASSPHRASE` are treated as unsafe and require `--allow-unsafe-passphrase`.

## Local Config Persistence

Non-sensitive session helpers are persisted in `config.json` by network:

```json
{
  "sepolia": {
    "rpcs": ["https://..."],
    "tokens": [{ "address": "0x...", "symbol": "USDT", "decimals": "6" }]
  }
}
```

No passphrase/private key/session secret is stored in `config.json`.

## Guides

- Development: `docs/guides/development-guide.md`
- Usage: `docs/guides/usage-guide.md`
- Release: `docs/guides/release-guide.md`
