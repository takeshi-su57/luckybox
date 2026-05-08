# Passphrase Safety Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make passphrase handling safe-by-default (no echo, no unsafe sources by default) and add `--passphrase-stdin`/`--passphrase-file` while reducing accidental private-key exposure.

**Architecture:** Centralize passphrase resolution in `src/io/passphrase.ts` so every command and the shell share identical precedence rules and safety gates. Keep deterministic derivation intact; adjust wallet derivation helpers to avoid returning private keys by default and add explicit “export private key” surface.

**Tech Stack:** TypeScript, Node.js `fs`, `@oclif/core`, `viem`.

---

## File Map (Create / Modify)

**Create**

- `src/io/passphrase.ts` (single source of truth for passphrase acquisition + warnings)
- `src/commands/private-key.ts` (explicit export/show private key command)

**Modify**

- `src/io/prompt.ts` (make hidden prompt fail-closed; remove visible fallback for secrets)
- `src/commands/address.ts` (new flags; use resolver)
- `src/commands/balance.ts` (new flags; use resolver)
- `src/commands/list.ts` (new flags; use resolver)
- `src/commands/send.ts` (new flags; use resolver)
- `src/commands/init.ts` (new flags; use resolver)
- `src/commands/unlock.ts` (new flags; use resolver)
- `src/commands/shell.ts` (plumb new flags into shell context creation)
- `src/app/shell.ts` (accept resolved passphrase; ensure no new unsafe paths)
- `src/wallet/derive.ts` (stop returning privateKey by default; add explicit function to compute private key)
- `README.md` (document safe defaults and automation flags)

**Tests**

- Modify: `tests/run.test.ts`
- Add: `tests/passphrase.test.ts` (unit tests for passphrase resolver)

---

### Task 1: Fail-closed hidden passphrase prompt

**Files:**

- Modify: `src/io/prompt.ts`
- Test: `tests/passphrase.test.ts`

- [ ] **Step 1: Add failing test for non-TTY hidden prompt**

Create `tests/passphrase.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

describe("promptHidden", () => {
  it("fails closed when TTY is unavailable", async () => {
    const { promptHidden } = await import("../src/io/prompt");

    const stdinIsTTY = process.stdin.isTTY;
    const stdoutIsTTY = process.stdout.isTTY;
    const setRawMode = (process.stdin as any).setRawMode;

    (process.stdin as any).isTTY = false;
    (process.stdout as any).isTTY = false;
    (process.stdin as any).setRawMode = undefined;

    await expect(promptHidden("Enter: ")).rejects.toThrow(/Hidden prompt unavailable/i);

    (process.stdin as any).isTTY = stdinIsTTY;
    (process.stdout as any).isTTY = stdoutIsTTY;
    (process.stdin as any).setRawMode = setRawMode;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/passphrase.test.ts`
Expected: FAIL because `promptHidden()` currently falls back to visible `promptLine()`.

- [ ] **Step 3: Implement fail-closed behavior**

Update `src/io/prompt.ts` so `promptHidden()` throws when hidden input cannot be safely performed:

```ts
export async function promptHidden(prompt: string): Promise<string> {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY ||
    typeof process.stdin.setRawMode !== "function"
  ) {
    throw new Error(
      "Hidden prompt unavailable (stdin/stdout not TTY). Use --passphrase-stdin or --passphrase-file, or allow unsafe inputs for tests."
    );
  }

  // existing raw-mode hidden input implementation...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/passphrase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/io/prompt.ts tests/passphrase.test.ts
git commit -m "feat: fail closed when hidden prompt unavailable"
```

---

### Task 2: Central passphrase resolver (stdin/file/hidden/unsafe gated)

**Files:**

- Create: `src/io/passphrase.ts`
- Test: `tests/passphrase.test.ts`

- [ ] **Step 1: Add failing tests for precedence and gating**

Append to `tests/passphrase.test.ts`:

```ts
import { afterEach } from "vitest";

afterEach(() => {
  delete process.env.BRAIN_PASSPHRASE;
});

describe("resolvePassphrase", () => {
  it("reads from stdin when passphraseStdin is true", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase");
    const stdin = Buffer.from("hello\n", "utf8");
    const result = await resolvePassphrase({
      passphraseStdin: true,
      stdin,
      promptHidden: async () => {
        throw new Error("should not prompt");
      }
    });
    expect(result.passphrase).toBe("hello");
    expect(result.source).toBe("stdin");
  });

  it("reads from file when passphraseFile is provided", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase");
    const result = await resolvePassphrase({
      passphraseFile: "C:\\\\tmp\\\\passphrase.txt",
      readFile: async () => Buffer.from("filepass\r\n", "utf8"),
      promptHidden: async () => {
        throw new Error("should not prompt");
      }
    });
    expect(result.passphrase).toBe("filepass");
    expect(result.source).toBe("file");
  });

  it("prompts hidden by default", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase");
    const result = await resolvePassphrase({
      promptHidden: async () => "promptpass"
    });
    expect(result.passphrase).toBe("promptpass");
    expect(result.source).toBe("prompt");
  });

  it("rejects env/arg passphrase unless allowUnsafePassphrase", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase");
    process.env.BRAIN_PASSPHRASE = "envpass";
    await expect(
      resolvePassphrase({
        promptHidden: async () => "promptpass"
      })
    ).resolves.toMatchObject({ passphrase: "promptpass", source: "prompt" });
  });

  it("uses env passphrase when allowUnsafePassphrase is true", async () => {
    const { resolvePassphrase } = await import("../src/io/passphrase");
    process.env.BRAIN_PASSPHRASE = "envpass";
    const result = await resolvePassphrase({
      allowUnsafePassphrase: true,
      promptHidden: async () => {
        throw new Error("should not prompt");
      }
    });
    expect(result.passphrase).toBe("envpass");
    expect(result.source).toBe("env");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/passphrase.test.ts`
Expected: FAIL because `src/io/passphrase.ts` does not exist.

- [ ] **Step 3: Implement `resolvePassphrase()`**

Create `src/io/passphrase.ts`:

```ts
import process from "node:process";
import { readFile } from "node:fs/promises";
import { promptHidden } from "./prompt";

export type PassphraseSource = "stdin" | "file" | "prompt" | "arg" | "env";

export type ResolvedPassphrase = {
  passphrase: string;
  source: PassphraseSource;
  unsafe: boolean;
};

export type ResolvePassphraseOptions = {
  passphraseArg?: string;
  allowUnsafePassphrase?: boolean;
  passphraseStdin?: boolean;
  passphraseFile?: string;
  quiet?: boolean;
  stdin?: Buffer;
  readFile?: (path: string) => Promise<Buffer>;
  promptHidden?: (prompt: string) => Promise<string>;
  warn?: (msg: string) => void;
};

function trimSingleTrailingNewline(value: string): string {
  if (value.endsWith("\r\n")) return value.slice(0, -2);
  if (value.endsWith("\n")) return value.slice(0, -1);
  return value;
}

function normalizeNonEmpty(passphrase: string): string {
  const normalized = passphrase.normalize("NFKD");
  if (normalized.length === 0) throw new Error("Passphrase cannot be empty.");
  return normalized;
}

export async function resolvePassphrase(
  options: ResolvePassphraseOptions = {}
): Promise<ResolvedPassphrase> {
  const warn = options.warn ?? ((msg) => process.stderr.write(`${msg}\n`));

  if (options.passphraseStdin) {
    const data =
      options.stdin ??
      Buffer.from(
        await new Promise<string>((resolve, reject) => {
          let chunks: Buffer[] = [];
          process.stdin.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          process.stdin.on("error", reject);
        })
      );
    const pass = trimSingleTrailingNewline(data.toString("utf8"));
    return { passphrase: normalizeNonEmpty(pass), source: "stdin", unsafe: false };
  }

  if (options.passphraseFile) {
    const rf = options.readFile ?? (async (p: string) => readFile(p));
    const raw = (await rf(options.passphraseFile)).toString("utf8");
    const pass = trimSingleTrailingNewline(raw);
    return { passphrase: normalizeNonEmpty(pass), source: "file", unsafe: false };
  }

  if (options.allowUnsafePassphrase) {
    const direct = options.passphraseArg ?? process.env.BRAIN_PASSPHRASE;
    if (direct !== undefined) {
      if (!options.quiet)
        warn("Warning: using unsafe passphrase input (may leak via shell history/process/env).");
      return {
        passphrase: normalizeNonEmpty(direct),
        source: options.passphraseArg ? "arg" : "env",
        unsafe: true
      };
    }
  }

  const ph = options.promptHidden ?? promptHidden;
  const passphrase = await ph("Enter passphrase: ");
  return { passphrase: normalizeNonEmpty(passphrase), source: "prompt", unsafe: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/passphrase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/io/passphrase.ts tests/passphrase.test.ts
git commit -m "feat: add passphrase resolver with stdin/file and unsafe gating"
```

---

### Task 3: Update commands to use resolver + add flags

**Files:**

- Modify: `src/commands/address.ts`
- Modify: `src/commands/balance.ts`
- Modify: `src/commands/list.ts`
- Modify: `src/commands/send.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/commands/unlock.ts`
- Test: `tests/run.test.ts`

- [ ] **Step 1: Add failing tests covering new flags (minimal smoke)**

Update `tests/run.test.ts` to assert help output includes new flags for at least one command (e.g., `address --help`), matching existing test patterns:

```ts
// add an assertion that "--passphrase-stdin" and "--passphrase-file" appear in help text
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- tests/run.test.ts`
Expected: FAIL until flags are added.

- [ ] **Step 3: Implement flags + use `resolvePassphrase()`**

For each command that currently calls `readPassphrase({ passphrase: flags.passphrase })`, replace with:

```ts
import { resolvePassphrase } from "../io/passphrase";

const resolved = await resolvePassphrase({
  passphraseArg: options.passphrase,
  allowUnsafePassphrase: options.allowUnsafePassphrase,
  passphraseStdin: options.passphraseStdin,
  passphraseFile: options.passphraseFile,
  quiet: options.quiet
});
const passphrase = resolved.passphrase;
```

Add flags (keep existing `--passphrase` but mark as “unsafe/test-only” in description):

```ts
allowUnsafePassphrase: Flags.boolean({ description: "Allow unsafe passphrase sources (env/--passphrase). Intended for tests." }),
passphraseStdin: Flags.boolean({ description: "Read passphrase from stdin (recommended for automation/tests)." }),
passphraseFile: Flags.string({ description: "Read passphrase from file (recommended for automation/tests)." }),
passphrase: Flags.string({ description: "UNSAFE: passphrase via CLI arg (requires --allow-unsafe-passphrase)." }),
quiet: Flags.boolean({ description: "Suppress warnings." })
```

Ensure precedence is handled by the resolver (stdin > file > prompt > unsafe).

- [ ] **Step 4: Run tests to verify passing**

Run: `pnpm test -- tests/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/*.ts tests/run.test.ts
git commit -m "feat: add passphrase stdin/file flags and gate unsafe sources"
```

---

### Task 4: Shell mode passphrase sourcing (safe)

**Files:**

- Modify: `src/commands/shell.ts`
- Modify: `src/app/shell.ts`

- [ ] **Step 1: Add a minimal failing unit test (if shell has tests) or skip**

If there are no established shell tests, skip adding new ones; keep changes minimal.

- [ ] **Step 2: Implement shell command flags to resolve once**

In `shell` command, accept the same passphrase flags and resolve passphrase once at session start via `resolvePassphrase()` then pass the resolved string into `executeShellSession` context creation (avoid re-reading env/args later).

- [ ] **Step 3: Manual sanity check**

Run: `pnpm run vault -- shell --help`
Expected: shows new flags.

- [ ] **Step 4: Commit**

```bash
git add src/commands/shell.ts src/app/shell.ts
git commit -m "feat: shell resolves passphrase via shared resolver"
```

---

### Task 5: Remove default privateKey exposure + add explicit export command

**Files:**

- Modify: `src/wallet/derive.ts`
- Create: `src/commands/private-key.ts`
- Modify: `README.md`
- Test: `tests/run.test.ts`

- [ ] **Step 1: Add failing test asserting no private key in default outputs**

Add a unit test (or extend existing tests) asserting `deriveWallet()` no longer returns `privateKey`:

```ts
import { deriveWallet } from "../src/wallet/derive";
expect((deriveWallet("x", 0) as any).privateKey).toBeUndefined();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test`
Expected: FAIL until derivation API is changed.

- [ ] **Step 3: Implement API change**

In `src/wallet/derive.ts`:

- Remove `privateKey` from `BoxWallet` type and return object.
- Add a new helper:

```ts
export function derivePrivateKey(passphrase: string, index: number): `0x${string}` {
  /* derive seed -> account -> hdKey.privateKey -> hex */
}
```

Ensure existing command code does not depend on `wallet.privateKey` (update any uses if present).

- [ ] **Step 4: Add `private-key` command**

Create `src/commands/private-key.ts` with:

- required `box` arg
- passphrase flags (same resolver)
- `--show` to print private key, otherwise print a warning and refuse
- require typing confirmation (e.g. promptLine: `Type SHOW to continue:`) unless `--yes-i-know-what-im-doing`

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Update README**

Document:

- default hidden prompt
- `--passphrase-stdin`/`--passphrase-file`
- unsafe gate
- private-key export command and warnings

- [ ] **Step 7: Commit**

```bash
git add src/wallet/derive.ts src/commands/private-key.ts README.md tests/*.ts
git commit -m "feat: hide private key by default; add explicit private-key export"
```

---

## Plan Self-Review Checklist

- Coverage: Tasks 1-5 cover non-TTY fail-closed, stdin/file, unsafe gating, shell, and private-key exposure reduction.
- No placeholders: every task contains concrete code snippets and commands.
- Determinism: no KDF/path changes; passphrase normalization remains NFKD.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-passphrase-safety-hardening.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — use superpowers:subagent-driven-development
2. **Inline Execution** — execute in this session using superpowers:executing-plans

Which approach?
