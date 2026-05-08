# Luckybox NPM Global Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `luckybox` as a globally installable npm CLI (`npm install -g luckybox`) with main-branch-only CI/CD releases and first publish version `0.1.1`.

**Architecture:** We enforce the release contract with tests first, then implement package metadata + CLI branding changes, then add GitHub Actions and Changesets automation constrained to `main`, and finally update user/maintainer docs. Each task is isolated, verified, and committed before moving to the next.

**Tech Stack:** TypeScript, Node.js, pnpm, Vitest, Oclif, GitHub Actions, Changesets, npm registry.

---

## File Structure

### Create

- `.github/workflows/ci.yml`
  - Runs typecheck/lint/format/test/build on PRs and `main` pushes.
- `.github/workflows/release.yml`
  - Runs Changesets release flow on `main` only (release PR + npm publish).
- `.changeset/config.json`
  - Changesets config with `baseBranch: main` and public access.
- `.changeset/production-ready-0-1-1.md`
  - Initial changeset entry for `0.1.1`.
- `tests/release-config.test.ts`
  - Verifies workflow + changeset automation contracts from file contents.
- `docs/guides/release-guide.md`
  - Maintainer runbook for release pipeline, secrets, and recovery.

### Modify

- `package.json`
  - Publishable metadata, bin rename to `luckybox`, release scripts, changesets scripts/dependency.
- `pnpm-lock.yaml`
  - Lockfile update for `@changesets/cli`.
- `tests/vitest-config.test.ts`
  - Add assertions for npm publishability + CLI contract.
- `tests/run.test.ts`
  - Assert usage errors point to `luckybox` command examples.
- `tests/shell.test.ts`
  - Assert shell prompt branding uses `luckybox>`.
- `src/commands/address.ts`
- `src/commands/balance.ts`
- `src/commands/send.ts`
  - Update usage strings from `vault` to `luckybox`.
- `src/app/shell.ts`
  - Update interactive prompt label from `vault>` to `luckybox>`.
- `README.md`
- `docs/guides/development-guide.md`
- `docs/guides/usage-guide.md`
- `docs/testing/deterministic-key-test-plan.md`
- `docs/validation/sepolia-scenario.md`
  - Update command examples and migration notes.

---

### Task 1: Enforce Package Publish and CLI Entry Contract

**Files:**

- Modify: `tests/vitest-config.test.ts`
- Modify: `package.json`
- Test: `tests/vitest-config.test.ts`

- [ ] **Step 1: Write the failing test for publishable package + `luckybox` bin**

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  version?: string;
  private?: boolean;
  bin?: Record<string, string>;
  oclif?: { bin?: string };
  scripts?: Record<string, string>;
  files?: string[];
};

describe("vitest config", () => {
  it("scopes default test scripts to source test files only", () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.test ?? "").toContain(" tests");
    expect(packageJson.scripts?.["test:watch"] ?? "").toContain(" tests");
    expect(packageJson.scripts?.["test:coverage"] ?? "").toContain(" tests");
    expect(packageJson.scripts?.["test:integration"] ?? "").toContain(" tests/integration");
    expect(packageJson.scripts?.["test:e2e"] ?? "").toContain(" tests/e2e");
    expect(packageJson.scripts?.test ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:watch"] ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:coverage"] ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:integration"] ?? "").toContain("--exclude dist/**");
    expect(packageJson.scripts?.["test:e2e"] ?? "").toContain("--exclude dist/**");
  });

  it("defines npm-publishable luckybox CLI contract", () => {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;

    expect(packageJson.private).toBe(false);
    expect(packageJson.version).toBe("0.1.1");
    expect(packageJson.bin).toEqual({ luckybox: "./bin/run.js" });
    expect(packageJson.oclif?.bin).toBe("luckybox");
    expect(packageJson.scripts?.luckybox ?? "").toContain("node ./bin/run.js");
    expect(packageJson.scripts).not.toHaveProperty("vault");
    expect(packageJson.files).toEqual(["bin", "dist", "README.md"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --pool=threads tests/vitest-config.test.ts`
Expected: FAIL because package is still `private: true`, version is `0.1.0`, and `bin`/`oclif` still point to `vault`.

- [ ] **Step 3: Implement minimal package metadata and bin changes**

```json
{
  "name": "luckybox",
  "version": "0.1.1",
  "private": false,
  "packageManager": "pnpm@9.15.4",
  "repository": {
    "type": "git",
    "url": "https://github.com/takeshi-su57/luckybox.git"
  },
  "homepage": "https://github.com/takeshi-su57/luckybox#readme",
  "bugs": {
    "url": "https://github.com/takeshi-su57/luckybox/issues"
  },
  "files": ["bin", "dist", "README.md"],
  "bin": {
    "luckybox": "./bin/run.js"
  },
  "oclif": {
    "bin": "luckybox",
    "commands": "./dist/src/commands"
  },
  "scripts": {
    "clean": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\"",
    "build": "pnpm -s run clean && tsc -p tsconfig.build.json",
    "build:watch": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "dev": "node ./bin/dev.js",
    "luckybox": "pnpm -s run build && node ./bin/run.js",
    "test": "vitest run --pool=threads tests --exclude dist/**",
    "test:watch": "vitest --pool=threads tests --exclude dist/**",
    "test:coverage": "vitest run --pool=threads --coverage tests --exclude dist/**",
    "test:integration": "vitest run --pool=threads tests/integration --exclude dist/**",
    "test:e2e": "vitest run --pool=threads tests/e2e --exclude dist/**",
    "test:e2e:scenario": "vitest run --pool=threads tests/e2e/sepolia-scenario.test.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests --ext .ts",
    "lint:fix": "pnpm run lint -- --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --pool=threads tests/vitest-config.test.ts`
Expected: PASS with all tests green in `tests/vitest-config.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add tests/vitest-config.test.ts package.json
git commit -m "chore(pkg): publish as luckybox CLI"
```

---

### Task 2: Update CLI-Facing Usage Strings and Shell Prompt Branding

**Files:**

- Modify: `tests/run.test.ts`
- Modify: `tests/shell.test.ts`
- Modify: `src/commands/address.ts`
- Modify: `src/commands/balance.ts`
- Modify: `src/commands/send.ts`
- Modify: `src/app/shell.ts`
- Test: `tests/run.test.ts`
- Test: `tests/shell.test.ts`

- [ ] **Step 1: Write failing tests for `luckybox` usage strings and prompt label**

```ts
// tests/run.test.ts (append these cases)
it("runAddressCommand points usage to luckybox", async () => {
  await expect(runAddressCommand({ box: "", passphrase: "unit" })).rejects.toThrow(
    /Usage: luckybox address box1/
  );
});

it("runBalanceCommand points usage to luckybox", async () => {
  await expect(runBalanceCommand({ box: "" })).rejects.toThrow(/Usage: luckybox balance box1/);
});

it("runSendCommand points usage to luckybox", async () => {
  await expect(
    runSendCommand({ box: "", to: "0x0000000000000000000000000000000000000001", amount: "1" })
  ).rejects.toThrow(/Usage: luckybox send box1/);
});
```

```ts
// tests/shell.test.ts (inside "prompts passphrase once and executes ..." test)
const promptInputs: string[] = [];

await executeShellSession({
  readPassphrase,
  promptLine: async (prompt) => {
    promptInputs.push(prompt);
    return prompts[i++] ?? "exit";
  },
  log: (line) => logs.push(line)
});

expect(promptInputs).toContain("luckybox> ");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run --pool=threads tests/run.test.ts tests/shell.test.ts`
Expected: FAIL because source still uses `vault` in usage text and shell prompt.

- [ ] **Step 3: Implement `luckybox` usage strings and shell prompt label**

```ts
// src/commands/address.ts
if (!options.box) {
  throw new Error("Missing wallet alias. Usage: luckybox address box1 [--show] [--copy]");
}
```

```ts
// src/commands/balance.ts
if (!options.box) {
  throw new Error("Missing wallet alias. Usage: luckybox balance box1 [--rpc-url <url>]");
}
```

```ts
// src/commands/send.ts
if (!options.box) {
  throw new Error(
    "Missing wallet alias. Usage: luckybox send box1 --to <address> --amount <value> [--token <symbol|address>] [--rpc-url <url>]"
  );
}
```

```ts
// src/app/shell.ts
const raw = await deps.promptLine("luckybox> ");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run --pool=threads tests/run.test.ts tests/shell.test.ts`
Expected: PASS with new assertions for `luckybox` text and prompt.

- [ ] **Step 5: Commit**

```bash
git add tests/run.test.ts tests/shell.test.ts src/commands/address.ts src/commands/balance.ts src/commands/send.ts src/app/shell.ts
git commit -m "chore(cli): rename user-facing command references to luckybox"
```

---

### Task 3: Add CI/CD Contract Tests and Main-Only Workflows

**Files:**

- Create: `tests/release-config.test.ts`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Test: `tests/release-config.test.ts`

- [ ] **Step 1: Write failing tests for workflow presence and main-branch restrictions**

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkflow(relPath: string): string {
  const fullPath = path.resolve(process.cwd(), relPath);
  expect(existsSync(fullPath)).toBe(true);
  return readFileSync(fullPath, "utf8");
}

describe("release workflow config", () => {
  it("defines CI workflow for pull requests and main pushes", () => {
    const ci = readWorkflow(".github/workflows/ci.yml");
    expect(ci).toContain("pull_request:");
    expect(ci).toContain("push:");
    expect(ci).toMatch(/branches:\s*\n\s*- main/);
    expect(ci).toContain("pnpm run typecheck");
    expect(ci).toContain("pnpm run lint");
    expect(ci).toContain("pnpm run format:check");
    expect(ci).toContain("pnpm test");
    expect(ci).toContain("pnpm run build");
  });

  it("defines release workflow on main only and uses changesets", () => {
    const release = readWorkflow(".github/workflows/release.yml");
    expect(release).toContain("push:");
    expect(release).toMatch(/branches:\s*\n\s*- main/);
    expect(release).toContain("if: github.ref == 'refs/heads/main'");
    expect(release).toContain("changesets/action@v1");
    expect(release).toContain("NPM_TOKEN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --pool=threads tests/release-config.test.ts`
Expected: FAIL because `.github/workflows/ci.yml` and `.github/workflows/release.yml` do not exist yet.

- [ ] **Step 3: Implement CI and release workflows**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm run typecheck

      - name: Lint
        run: pnpm run lint

      - name: Format check
        run: pnpm run format:check

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm run build
```

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Create release PR or publish
        uses: changesets/action@v1
        with:
          commit: "chore(release): version packages"
          title: "chore(release): version packages"
          version: pnpm changeset version
          publish: pnpm run release:publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --pool=threads tests/release-config.test.ts`
Expected: PASS with both workflow contract tests green.

- [ ] **Step 5: Commit**

```bash
git add tests/release-config.test.ts .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "ci(release): add main-only workflows with changesets"
```

---

### Task 4: Configure Changesets and Release Scripts

**Files:**

- Modify: `tests/vitest-config.test.ts`
- Modify: `package.json`
- Create: `.changeset/config.json`
- Create: `.changeset/production-ready-0-1-1.md`
- Modify: `pnpm-lock.yaml`
- Test: `tests/vitest-config.test.ts`

- [ ] **Step 1: Extend test coverage for changeset/release scripts and dependencies**

```ts
// tests/vitest-config.test.ts (append inside "defines npm-publishable luckybox CLI contract")
expect(packageJson.scripts?.changeset).toBe("changeset");
expect(packageJson.scripts?.["release:check"] ?? "").toContain("pnpm run build");
expect(packageJson.scripts?.["release:check"] ?? "").toContain("npm pack --dry-run");
expect(packageJson.scripts?.["release:publish"] ?? "").toContain("changeset publish");
expect(packageJson.scripts?.prepublishOnly).toBe("pnpm run release:check");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --pool=threads tests/vitest-config.test.ts`
Expected: FAIL because changeset/release scripts are not defined yet.

- [ ] **Step 3: Implement changesets config, release scripts, and initial release entry**

```bash
pnpm add -D @changesets/cli
```

```json
// package.json (scripts section additions)
{
  "scripts": {
    "changeset": "changeset",
    "release:check": "pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm test && pnpm run build && npm pack --dry-run",
    "release:publish": "pnpm run release:check && changeset publish",
    "prepublishOnly": "pnpm run release:check"
  }
}
```

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

```md
## <!-- .changeset/production-ready-0-1-1.md -->

## "luckybox": patch

Prepare the CLI for production npm distribution with `luckybox` as the global command, main-only CI/release automation, and release safety checks.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --pool=threads tests/vitest-config.test.ts`
Expected: PASS with script assertions green.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .changeset/config.json .changeset/production-ready-0-1-1.md tests/vitest-config.test.ts
git commit -m "chore(release): add changesets and publish safety scripts"
```

---

### Task 5: Update User and Maintainer Documentation for `luckybox` + Release Runbook

**Files:**

- Modify: `README.md`
- Modify: `docs/guides/development-guide.md`
- Modify: `docs/guides/usage-guide.md`
- Modify: `docs/testing/deterministic-key-test-plan.md`
- Modify: `docs/validation/sepolia-scenario.md`
- Create: `docs/guides/release-guide.md`

- [ ] **Step 1: Write documentation updates for command rename and install flow**

````md
<!-- README.md: add install + replace command examples -->

## Install

```bash
npm install -g luckybox
luckybox --help
```

## Scripts

- `pnpm run luckybox -- --help`

## Interactive Shell

```bash
pnpm run luckybox -- shell
```

Migration note:

- `vault` command has been removed.
- Use `luckybox` for all CLI invocations.
````

````md
<!-- docs/guides/release-guide.md -->

# Release Guide

## Required Secret

- `NPM_TOKEN` (repository secret)

## Main-Only Release Flow

1. Merge feature PRs (with `.changeset/*.md`) into `main`.
2. `Release` workflow opens/updates release PR via Changesets.
3. Review and merge release PR into `main`.
4. Workflow publishes to npm using `NPM_TOKEN`.

## Safety Gates

- CI must pass: `typecheck`, `lint`, `format:check`, `test`, `build`.
- Publish gate: `pnpm run release:check`.

## Failed Publish Recovery

1. Fix root cause on a branch.
2. Merge fix into `main`.
3. Re-run `Release` workflow from the latest `main` commit.
4. Verify published version with:

```bash
npm view luckybox version
```

## Command Rename Note

- Legacy `vault` command is removed.
- Users must run `luckybox`.
````

- [ ] **Step 2: Run a targeted stale-reference check**

Run: `rg -n "pnpm run vault|\bvault\s+(address|balance|send|shell|list)|\bvault --" README.md docs/guides docs/testing docs/validation`
Expected: No matches in updated user/maintainer docs.

- [ ] **Step 3: Apply missing replacements until grep returns clean**

```md
# Required command replacements across docs in scope

pnpm run vault -- --help -> pnpm run luckybox -- --help
pnpm run vault -- shell -> pnpm run luckybox -- shell
pnpm run vault -- address ... -> pnpm run luckybox -- address ...
pnpm run vault -- list ... -> pnpm run luckybox -- list ...
pnpm run vault -- balance ... -> pnpm run luckybox -- balance ...
pnpm run vault -- send ... -> pnpm run luckybox -- send ...
```

- [ ] **Step 4: Re-run stale-reference check to verify it passes**

Run: `rg -n "pnpm run vault|\bvault\s+(address|balance|send|shell|list)|\bvault --" README.md docs/guides docs/testing docs/validation`
Expected: Exit code 1 / no output (no stale command references in scoped docs).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/guides/development-guide.md docs/guides/usage-guide.md docs/testing/deterministic-key-test-plan.md docs/validation/sepolia-scenario.md docs/guides/release-guide.md
git commit -m "docs: publish and release workflow for luckybox"
```

---

### Task 6: Full Verification and Release-Readiness Evidence

**Files:**

- Modify: none (verification only)
- Test: full repository checks

- [ ] **Step 1: Run typecheck gate**

Run: `pnpm run typecheck`
Expected: PASS (exit code 0).

- [ ] **Step 2: Run lint gate**

Run: `pnpm run lint`
Expected: PASS (exit code 0).

- [ ] **Step 3: Run format gate**

Run: `pnpm run format:check`
Expected: PASS (exit code 0).

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: PASS (all test files green, including new release/config contract tests).

- [ ] **Step 5: Run package dry-run evidence**

Run: `npm pack --dry-run`
Expected: PASS with tarball file list showing `bin/`, `dist/`, and required metadata only.

- [ ] **Step 6: Commit verification artifacts if any tracked files changed**

```bash
git status --short
# If no tracked file changes: no commit required for this step.
# If tracked files changed unexpectedly, inspect and commit only intentional updates.
```

---

## Spec Coverage Check

- Global npm install contract (`luckybox` only): covered by Task 1 + Task 2 + docs in Task 5.
- Main-only CI/CD: covered by Task 3 workflow implementation + tests.
- Version/release management with Changesets: covered by Task 4.
- First release target `0.1.1`: enforced in Task 1 package contract + Task 4 initial changeset.
- Publish safeguards (`release:check`, pack dry-run, required checks): covered by Task 4 + Task 6.
- Maintainer runbook + migration note: covered by Task 5.

## Placeholder Scan

- No `TODO`, `TBD`, “implement later”, or unspecified command placeholders remain.

## Type/Interface Consistency Check

- CLI command name is consistently `luckybox` across package metadata, runtime messages, tests, and docs.
- Release commands are consistently `changeset`, `release:check`, and `release:publish`.
- Workflow branch guard is consistently `main` with explicit `refs/heads/main` runtime check.
