# Sepolia Validation Scenario

Recovery standard name: `Luckybox Deterministic Key Standard v1`

## 1) Configure `.env`

Create `.env` in repo root:

```bash
ETH_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
BRAIN_WALLET_SALT=brainvault:v1:ethereum
VAULT_NETWORK=sepolia
VAULT_NATIVE_TOKEN=ETH
VAULT_ERC20_TOKENS=USDC:0x1c7d4b196cb0c7b01d743fbc6116a902379c7238
```

Note: replace token addresses with the contracts you actually intend to test.

## 2) Determinism + Privacy Checks

```bash
pnpm run vault -- list --passphrase "my test passphrase"
pnpm run vault -- list --passphrase "my test passphrase"
```

Expected:

- `box1` and `box2` addresses are identical across runs.
- Output is masked (`0x123...abcde`) by default.
- No local wallet files are created (deterministic/no persistence).

## 3) Address Commands

```bash
pnpm run vault -- address box1 --passphrase "my test passphrase"
pnpm run vault -- address box1 --show --passphrase "my test passphrase"
pnpm run vault -- address box1 --copy --passphrase "my test passphrase"
```

Expected:

- Default address output is masked.
- `--show` prints full `0x...` address.
- `--copy` places full address on clipboard.

## 4) Fund Wallet on Sepolia

Fund `box1` address with Sepolia ETH from a faucet.

## 5) Balance Checks

Native:

```bash
pnpm run vault -- balance box1 --passphrase "my test passphrase"
```

ERC20 by symbol (from `.env`):

```bash
pnpm run vault -- balance box1 --token USDC --passphrase "my test passphrase"
```

Expected:

- Network displays `sepolia`.
- Chain guard enforces Sepolia (`11155111`) from `VAULT_NETWORK=sepolia`.
- Native and token balances resolve correctly.

## 6) Send Flow Safety + Execution

Native transfer:

```bash
pnpm run vault -- send box1 --to 0xRECEIVER --amount 0.001 --passphrase "my test passphrase"
```

ERC20 transfer:

```bash
pnpm run vault -- send box1 --to 0xRECEIVER --amount 1 --token USDC --passphrase "my test passphrase"
```

Expected:

- CLI shows preview (`from`, `to`, chain, gas, nonce, fee data).
- CLI warns with `Warning: public transaction`.
- Transaction sends only after typing `send` at confirmation prompt.

## 7) Salt Variation Check

Change `BRAIN_WALLET_SALT`, re-run `list` with same passphrase.

Expected:

- Derived addresses change, confirming salt is active and configurable.
