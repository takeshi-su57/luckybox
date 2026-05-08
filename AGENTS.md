# Agent Guide

## Mandatory Workflow (Superpowers First)

This repository uses the `.agents/skills/using-superpowers` process as the default execution model.

Required behavior for every new user request:

1. Check whether any local skill applies before doing any implementation action.
2. If there is even a small chance a skill applies, load that skill first and follow it.
3. Prioritize process skills before implementation skills:
   - first: `brainstorming`, `systematic-debugging`, `test-driven-development`, etc.
   - second: domain/task implementation skills.
4. If a loaded skill has a checklist, convert it into a tracked execution plan and complete it.
5. Do not skip skill workflow because a task seems simple.

Priority model:

1. User instructions in this repository or direct user chat requests
2. Superpowers skill workflow
3. Default assistant behavior

Operational note for Codex:

- Skill files are available under `.agents/skills/`.
- For Codex mapping and multi-agent equivalents, see:
  - `.agents/skills/using-superpowers/references/codex-tools.md`

## Repository Purpose

This repository implements a deterministic EVM key/address CLI.

Core invariant:

- If a user knows `passphrase` + `BRAIN_WALLET_SALT` + the standard definition, derived keys/addresses must be reproducible.

Standard reference:

- Name: `Luckybox Deterministic Key Standard v1`
- Spec: `docs/standards/deterministic-key-standard-v1.md`

## Stack

- Language: TypeScript
- Runtime target: Node.js (ESM build output in `dist/`)
- CLI parser: `@oclif/core`
- Chain/client lib: `viem`
- Package manager: `pnpm` (required)

## Quick Commands

- `pnpm run vault -- --help`
- `pnpm run build`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm test`

## Repo Map

- `src/commands/`: CLI commands (`address`, `balance`, `send`, `shell`, etc.)
- `src/app/`: shell/session workflows and shared app-level logic
- `src/crypto/`: KDF + HD derivation helpers
- `src/config/`: env parsing, supported-chain mapping, local config persistence
- `src/io/`: hidden prompt and clipboard helpers
- `src/wallet/`: deterministic derivation domain logic + standard constants
- `tests/run.test.ts`: unit test suite (Vitest)
- `tests/integration/`: read-only testnet integration tests
- `tests/e2e/`: live testnet scenario tests
- `docs/standards/`: public-standard based derivation spec
- `docs/testing/`: test strategy and validation scenarios

## Non-Negotiable Rules

1. Do not change KDF params/path rules silently.
2. If derivation behavior changes, version the standard name/method and add migration docs.
3. Keep supported networks limited to:
   - `ethereum`
   - `arbitrum`
   - `sepolia`
   - `base`
   - `polygon`
4. Use viem built-ins (for example `erc20Abi`) over custom ABI copies when available.
5. Preserve safe defaults (masked output, explicit send confirmation).

## Before Finishing Any Change

Run all:

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm test
```

## Local Skills Found In `.agents/skills`

Available skill folders:

- `brainstorming`
- `dispatching-parallel-agents`
- `executing-plans`
- `finishing-a-development-branch`
- `receiving-code-review`
- `remembering-conversations`
- `requesting-code-review`
- `subagent-driven-development`
- `systematic-debugging`
- `test-driven-development`
- `using-git-worktrees`
- `using-superpowers`
- `verification-before-completion`
- `writing-plans`
- `writing-skills`

When a task matches one of these, load the corresponding `SKILL.md` first and follow it.

Recommended startup skill:

- `using-superpowers` (always apply at conversation start unless explicitly operating as a narrowly scoped subagent task)
