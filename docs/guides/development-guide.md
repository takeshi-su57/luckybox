# Development Guide

## Prerequisites

- Node.js (LTS recommended)
- `pnpm` 9+

## Install

```bash
pnpm install
```

## Build and Run CLI

```bash
pnpm run build
pnpm run vault -- --help
```

Run interactive shell:

```bash
pnpm run vault -- shell
```

## Quality Gates

Run before every commit:

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
```

## Test Commands

- Unit tests:

```bash
pnpm vitest run --pool=threads tests/run.test.ts
```

- Integration tests (Sepolia read-only):

```bash
pnpm run test:integration
```

- E2E tests:

```bash
pnpm run test:e2e
```

- Full scenario E2E:

```bash
pnpm run test:e2e:scenario
```

## Testnet Configuration

1. Copy `.env.testnet.example` to `.env.testnet`.
2. Fill all required values.
3. For value-transferring E2E, set:
   - `TEST_ENABLE_E2E=true`
   - `TESTNET_ALLOW_VALUE_TRANSFER=true`

## Notes

- `vault shell` stores passphrase in runtime memory only for the process lifetime.
- `config.json` stores only non-sensitive data per network:
  : `rpcs[]`, `tokens[]` (`address`, `symbol`, `decimals` as string).
- Some mock tokens are non-standard and may reject transfer paths between wallets.
- E2E scenario includes capability checks and warning logs for restricted token behavior.
- If RPC is unstable, rerun the command; public endpoints can timeout intermittently.
