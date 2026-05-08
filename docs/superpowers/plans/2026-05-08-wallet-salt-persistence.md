# Global Wallet Salt Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a global `wallet_salt` in `config.json`, prompt on first use if missing, keep env override support, and add `luckybox salt get/set/clear` management commands with confirmations.

**Architecture:** Add a global section to `config.json` and extend `src/config/local-config.ts` with global getters/setters. Add `src/config/wallet-salt.ts` to resolve the effective salt (env > config > prompt+persist). Thread the resolved salt into derivation by updating `deriveSeed()` / wallet derivation helpers to accept an explicit salt while preserving deterministic behavior.

**Tech Stack:** TypeScript, Node.js, `@oclif/core`, existing local-config persistence.

---

## File Map (Create / Modify)

**Create**

- `src/config/wallet-salt.ts` (resolve salt, prompt/persist, env override)
- `src/commands/salt.ts` (get/set/clear subcommands)
- `tests/wallet-salt.test.ts` (unit tests: precedence, persistence behavior)

**Modify**

- `src/config/local-config.ts` (add `_global.walletSalt` support)
- `src/config/kdf.ts` (env-only salt becomes wallet-salt resolver integration)
- `src/crypto/kdf.ts` (allow passing explicit salt into scrypt)
- `src/wallet/derive.ts` (thread salt through deriveSeed/deriveWallet)
- `src/commands/address.ts` (resolve salt before deriving)
- `src/commands/balance.ts` (resolve salt before deriving)
- `src/commands/send.ts` (resolve salt before deriving)
- `src/commands/list.ts` (resolve salt before deriving)
- `src/commands/init.ts` (resolve salt before deriving; confirmation still works)
- `src/commands/unlock.ts` (resolve salt before deriving)
- `src/commands/shell.ts` / `src/app/shell.ts` (resolve salt once per session and store in context)
- `docs/guides/usage-guide.md` (update salt instructions; env no longer “required”)

---

### Task 1: Extend `config.json` schema with global wallet salt

**Files:**

- Modify: `src/config/local-config.ts`
- Test: `tests/wallet-salt.test.ts`

- [ ] **Step 1: Write failing tests for global config persistence**

Create `tests/wallet-salt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadLocalConfig, saveLocalConfig } from "../src/config/local-config";

describe("local-config global walletSalt", () => {
  it("persists _global.walletSalt", async () => {
    const file = await loadLocalConfig();
    file._global = { walletSalt: "my-salt" } as any;
    await saveLocalConfig(file);
    const again = await loadLocalConfig();
    expect((again as any)._global?.walletSalt).toBe("my-salt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd test -- tests/wallet-salt.test.ts`
Expected: FAIL until `_global` is supported/sanitized.

- [ ] **Step 3: Implement global config support**

In `src/config/local-config.ts`:

- Add types:

```ts
export type GlobalLocalConfig = { walletSalt?: string };
export type LocalConfigFile = Record<string, NetworkLocalConfig> & { _global?: GlobalLocalConfig };
```

- Add sanitizer for `_global.walletSalt` (string, trimmed, non-empty).
- Ensure `loadLocalConfig()` preserves `_global`.
- Add helpers:
  - `getGlobalWalletSalt(): Promise<string | undefined>`
  - `setGlobalWalletSalt(value: string): Promise<void>`
  - `clearGlobalWalletSalt(): Promise<void>`

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm.cmd test -- tests/wallet-salt.test.ts`
Expected: PASS.

---

### Task 2: Implement salt resolver (env > config > prompt+persist)

**Files:**

- Create: `src/config/wallet-salt.ts`
- Modify: `src/config/kdf.ts`
- Test: `tests/wallet-salt.test.ts`

- [ ] **Step 1: Add failing tests for precedence**

Append to `tests/wallet-salt.test.ts`:

```ts
import process from "node:process";

it("prefers env override when set", async () => {
  const { resolveWalletSalt } = await import("../src/config/wallet-salt");
  process.env.BRAIN_WALLET_SALT = "env-salt";
  const resolved = await resolveWalletSalt({ prompt: async () => "prompt-salt" });
  expect(resolved.salt).toBe("env-salt");
  expect(resolved.source).toBe("env");
  delete process.env.BRAIN_WALLET_SALT;
});
```

- [ ] **Step 2: Implement `resolveWalletSalt()`**

Create `src/config/wallet-salt.ts`:

```ts
import process from "node:process";
import { getGlobalWalletSalt, setGlobalWalletSalt } from "./local-config";

export type WalletSaltSource = "env" | "config" | "prompt";
export type ResolvedWalletSalt = { salt: string; source: WalletSaltSource };

export async function resolveWalletSalt(options?: {
  prompt?: (message: string) => Promise<string>;
}): Promise<ResolvedWalletSalt> {
  const env = process.env.BRAIN_WALLET_SALT;
  if (env !== undefined) {
    const trimmed = env.trim();
    if (trimmed.length === 0) throw new Error("Invalid BRAIN_WALLET_SALT: value cannot be blank.");
    return { salt: trimmed, source: "env" };
  }

  const fromConfig = await getGlobalWalletSalt();
  if (fromConfig) return { salt: fromConfig, source: "config" };

  const prompt = options?.prompt;
  if (!prompt) {
    throw new Error("Wallet salt is not set. Run `luckybox salt set` or set BRAIN_WALLET_SALT.");
  }
  const input = (await prompt("Enter wallet salt: ")).trim();
  if (!input) throw new Error("Wallet salt cannot be blank.");
  await setGlobalWalletSalt(input);
  return { salt: input, source: "prompt" };
}
```

- [ ] **Step 3: Update `src/config/kdf.ts` to use new resolver for env validation**

Keep any existing exports needed by other modules, but stop calling env directly from random places. If a synchronous `getKdfSalt()` remains, document it as env-only fallback for tests; otherwise remove/replace usages.

- [ ] **Step 4: Run tests**

Run: `pnpm.cmd test -- tests/wallet-salt.test.ts`
Expected: PASS.

---

### Task 3: Thread salt through KDF + wallet derivation (no behavior change)

**Files:**

- Modify: `src/crypto/kdf.ts`
- Modify: `src/wallet/derive.ts`
- Modify: `tests/run.test.ts`

- [ ] **Step 1: Write failing test asserting reference vectors still match**

In `tests/run.test.ts`, update the deterministic vector test to pass salt explicitly through derivation helpers (or ensure resolver provides the same salt).

- [ ] **Step 2: Implement explicit salt parameter**

In `src/crypto/kdf.ts`:

- Change `deriveSeed(passphrase: string)` to `deriveSeed(passphrase: string, salt: string)` and remove internal salt lookup.

In `src/wallet/derive.ts`:

- Change `deriveWallet(passphrase, index)` -> `deriveWallet(passphrase, salt, index)`
- Update `deriveWalletByBox`, `deriveDefaultWallets`, and `derivePrivateKey*` similarly.

- [ ] **Step 3: Update tests accordingly**

Update calls in `tests/run.test.ts` to pass the explicit salt used by the vectors (e.g. `"brainvault:v1:ethereum"`).

- [ ] **Step 4: Run focused tests**

Run: `pnpm.cmd test -- tests/run.test.ts`
Expected: PASS.

---

### Task 4: Resolve salt in commands (prompt/persist on first use)

**Files:**

- Modify: `src/commands/address.ts`
- Modify: `src/commands/balance.ts`
- Modify: `src/commands/send.ts`
- Modify: `src/commands/list.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/commands/unlock.ts`
- Modify: `src/commands/shell.ts`
- Modify: `src/app/shell.ts`
- Modify: `src/app/wallet-summary.ts`
- Test: `tests/run.test.ts`

- [ ] **Step 1: Implement salt resolution and prompt plumbing**

In each command before calling any derivation function:

- Call `resolveWalletSalt({ prompt: promptLine })` (or similar prompt function).
- Pass `salt` into derivation helpers.

Shell:

- Resolve salt once before starting session.
- Store salt in session context and reuse for derived wallets.

- [ ] **Step 2: Add/adjust tests**

In unit tests that call `runAddressCommand` etc directly, pass salt explicitly or set env override for tests.

- [ ] **Step 3: Run tests**

Run: `pnpm.cmd test`
Expected: PASS.

---

### Task 5: Add `salt` management command (get/set/clear)

**Files:**

- Create: `src/commands/salt.ts`
- Test: `tests/wallet-salt.test.ts`

- [ ] **Step 1: Implement `salt get`**
- [ ] **Step 2: Implement `salt set` with confirmation**
  - prompt new salt
  - warn derived addresses will change
  - require typing `CHANGE SALT`
  - on success: print `Wallet salt updated.` and exit
- [ ] **Step 3: Implement `salt clear` with confirmation**
  - require typing `CLEAR SALT`
  - on success: print `Wallet salt cleared.` and exit

---

### Task 6: Update documentation

**Files:**

- Modify: `docs/guides/usage-guide.md`

- [ ] Update “Core Environment Variables” to reflect:
  - `BRAIN_WALLET_SALT` is optional override
  - default is persisted config with first-run prompt

---

## Execution Verification (required by repo)

After implementation:

- Run: `pnpm.cmd run typecheck`
- Run: `pnpm.cmd run lint`
- Run: `pnpm.cmd run format:check`
- Run: `pnpm.cmd test`
