# Deterministic Key Test Plan

## Goal

Prove that key/address derivation and CLI behavior are deterministic, stable, and safe-by-default.

## Scope

- Deterministic derivation logic
- Salt/passphrase normalization behavior
- Standard metadata stability
- CLI command behavior and validation
- Network guardrails for supported networks:
  - `ethereum`
  - `arbitrum`
  - `sepolia`
  - `base`
  - `polygon`

## Automated Tests

Run:

```bash
pnpm run typecheck
pnpm run lint
pnpm test
```

### Coverage (Automated)

1. Config parsing

- token mapping format and validation
- default config values
- supported network parsing
- unsupported network rejection

2. Deterministic KDF behavior

- same passphrase + same salt => same seed
- Unicode NFKD normalization stability
- different salts => different seeds

3. HD derivation behavior

- BIP44 path generation
- deterministic address derivation
- index sensitivity

4. Stable reference vectors

- fixed inputs produce fixed addresses:
  - salt: `brainvault:v1:ethereum`
  - passphrase: `correct horse battery staple`
  - index `0` => `0xf38D74C177A28c156F169d6D174b6a9EFA6A53A9`
  - index `1` => `0x7094E2253d32Cbb37DdcB26d85F4Af843193Cf50`

5. CLI behavior

- masked address output by default
- required argument/option validation

6. Standard metadata stability

- standard name and canonical method string are stable

## Manual Validation

### A) Deterministic Recovery

1. Set `.env` with:

- `BRAIN_WALLET_SALT`
- `VAULT_NETWORK`
- `ETH_RPC_URL`

2. Run:

```bash
pnpm run vault -- list --passphrase "my passphrase"
pnpm run vault -- list --passphrase "my passphrase"
```

Expected:

- same `box1`/`box2` addresses across runs
- masked output by default

### B) Salt Sensitivity

1. Keep passphrase fixed.
2. Change `BRAIN_WALLET_SALT`.
3. Re-run `list`.

Expected:

- derived addresses change

### C) Network Guardrail

1. Set `VAULT_NETWORK=sepolia`.
2. Use a non-sepolia RPC URL.
3. Run `balance` or `send`.

Expected:

- command fails with chain mismatch error

### D) Native + ERC20 Balance

1. Fund `box1` with native token on target network.
2. Configure ERC20 mapping in `.env`.
3. Run:

```bash
pnpm run vault -- balance box1 --passphrase "my passphrase"
pnpm run vault -- balance box1 --token USDC --passphrase "my passphrase"
```

Expected:

- native and token balances resolve correctly

### E) Send Safety

1. Run send command for native and ERC20.
2. Check preview output.
3. Enter anything except `send`.

Expected:

- transaction is cancelled unless confirmation is exactly `send`
