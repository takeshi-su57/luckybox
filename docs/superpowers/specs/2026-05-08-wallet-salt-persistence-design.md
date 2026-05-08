# Global Wallet Salt Persistence (Design)

Date: 2026-05-08

## Goal

Make `wallet_salt` (aka `BRAIN_WALLET_SALT`) easy and safe to use as a global namespace/prefix:

- Prompt once on first run if missing
- Persist to `config.json`
- View and change later via CLI
- Preserve deterministic derivation invariants

## Non-goals

- Changing KDF parameters or derivation paths
- Claiming wallet salt is a substitute for a strong passphrase

## Background / Current State

- Deterministic standard v1 depends on `passphrase + wallet_salt`.
- Today, salt comes from `process.env.BRAIN_WALLET_SALT` with a default fallback.
- `config.json` currently stores per-network non-sensitive config (RPCs, tokens).

## Requirements

### R1: Determinism / Compatibility

- Seed/address derivation MUST remain deterministic for the same passphrase + salt + index.
- Existing behavior with `BRAIN_WALLET_SALT` env override MUST continue to work.

### R2: Global Persisted Salt

- Add a global persisted wallet salt in `config.json`, independent of network.
- The persisted salt is used when env override is absent.

### R3: First-run Prompt

- If neither env override nor persisted salt exists, prompt:
  - `Enter wallet salt: `
- Persist immediately after input.
- Reject blank/whitespace-only.

### R4: Manageable via CLI

Add a `salt` command with subcommands:

- `luckybox salt get`
  - Prints the currently effective salt and its source (env vs config) if practical.
- `luckybox salt set`
  - Prompts for new salt
  - Shows warning: derived addresses will change
  - Requires confirmation input: `Type "CHANGE SALT" to continue:`
  - On success prints a single success line and exits immediately.
- `luckybox salt clear` (optional)
  - Clears persisted salt (does not affect env override)
  - Requires confirmation input: `Type "CLEAR SALT" to continue:`
  - On success prints a single success line and exits immediately.

### R5: Precedence Rules

Salt resolution order:

1. `process.env.BRAIN_WALLET_SALT` (override; tests/CI/power users)
2. `config.json` global salt
3. prompt + persist

### R6: Storage Format

Extend `config.json` to include a global section, e.g.:

```json
{
  "_global": { "walletSalt": "brainvault:v1:ethereum" },
  "sepolia": { "rpcs": [], "tokens": [] }
}
```

Notes:

- Backward compatible with existing per-network entries.
- `_global` key is reserved.

## Acceptance Criteria

- With no env var and no saved salt, running a command that needs derivation prompts once and then proceeds.
- With saved salt present, derivation uses it without prompting.
- With env var set, env value is used without modifying config.
- `salt get/set/clear` works and includes confirmation for mutation operations.
- Existing unit tests still pass; add coverage for config read/write and precedence.
