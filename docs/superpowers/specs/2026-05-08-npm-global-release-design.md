# NPM Global Release Design (Luckybox)

- Date: 2026-05-08
- Status: Approved for implementation planning
- Owner: CLI maintainers

## 1. Objective

Make the `luckybox` CLI production-ready for global npm installation and controlled releases.

Primary outcomes:

- Users can install globally with `npm install -g luckybox` and run `luckybox` directly.
- Releases are versioned and published through a main-branch-only GitHub CI/CD pipeline.
- First production publish target is `0.1.1`.

## 2. Scope

In scope:

- Package metadata and CLI command contract updates for npm distribution.
- Main-only GitHub Actions CI workflow.
- Changesets-based release workflow that opens release PRs and publishes from `main`.
- Initial release process setup for `0.1.1`.
- Release safeguards and maintainer documentation updates.

Out of scope:

- Any wallet derivation or cryptographic behavior change.
- Adding dual command aliases (`vault` + `luckybox`).
- Multi-registry publishing.

## 3. Product Decisions (Locked)

- Package name: `luckybox` (unscoped).
- First release version: `0.1.1`.
- Global command: `luckybox` only.
- Legacy command: `vault` removed immediately.
- Release strategy: Changesets release PR + publish from `main` only.

## 4. Architecture and Components

### 4.1 Package Contract Layer

Component: `package.json` publish/CLI metadata.

Responsibilities:

- Enable publishing (`private: false`).
- Expose only `luckybox` command through `bin`.
- Set version baseline for first release (`0.1.1`).
- Provide complete npm metadata and controlled file inclusion.

Interface:

- Install command: `npm install -g luckybox`.
- Runtime command: `luckybox`.

### 4.2 CI Validation Layer

Component: `.github/workflows/ci.yml`.

Responsibilities:

- Validate quality gates on PRs and pushes to `main`:
  - typecheck
  - lint
  - format check
  - tests
  - build

Interface:

- GitHub check runs attached to PR and `main` commits.

### 4.3 Release Orchestration Layer

Component: `.github/workflows/release.yml` powered by Changesets.

Responsibilities:

- Trigger only on `main` push.
- Open/update release PR when unreleased changesets exist.
- Publish to npm when release commit lands on `main`.

Security/Control:

- Requires `NPM_TOKEN` repository secret.
- Workflow permissions constrained to release tasks.
- Defense-in-depth guard on branch ref before publish step.

### 4.4 Maintainer Operations Layer

Components: README + release runbook docs.

Responsibilities:

- Document install/usage contract (`luckybox`, no `vault`).
- Document release mechanics and incident handling.

## 5. Data and Control Flow

### 5.1 Feature PR Flow

1. Contributor opens PR.
2. PR includes code changes and, for user-facing changes, a `.changeset/*.md` entry.
3. CI workflow runs full verification suite.
4. PR merges into `main` once checks pass.

### 5.2 Release PR Flow (Changesets)

1. Push to `main` triggers release workflow.
2. Changesets action inspects pending changesets.
3. If pending changesets exist:
   - Generate/update release PR with version bumps + changelog updates.
4. Maintainer reviews and merges release PR into `main`.

### 5.3 Publish Flow

1. Release commit on `main` triggers release workflow.
2. Workflow verifies branch is `refs/heads/main`.
3. Package publish runs using `NPM_TOKEN`.
4. Published artifact becomes available as `luckybox@<version>` on npm.

## 6. Failure Modes and Error Handling

### 6.1 npm Name/Ownership Conflict

Risk:

- Publish fails if package name ownership is not valid at publish time.

Handling:

- Preflight `npm view luckybox` check prior to first publish.
- If conflict appears unexpectedly, stop publish and migrate to scoped fallback design in a follow-up spec.

### 6.2 Missing or Invalid NPM_TOKEN

Risk:

- Publish job fails authentication.

Handling:

- Release workflow fails fast with explicit error.
- Runbook includes secret setup/rotation steps.

### 6.3 Broken Packaged Artifact

Risk:

- Published package missing required runtime files.

Handling:

- Enforce `npm pack --dry-run` in release checks.
- Maintain explicit package `files` allowlist.
- Keep `prepublishOnly` gate to build/test before publish.

### 6.4 Command Break for Existing `vault` Users

Risk:

- Existing users invoking `vault` fail after upgrade.

Handling:

- Changelog and README include explicit migration note:
  - `vault` removed.
  - use `luckybox`.

## 7. Testing Strategy

### 7.1 Pipeline Verification

- CI workflow validates:
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run format:check`
  - `pnpm test`
  - `pnpm run build`

### 7.2 Packaging Verification

- `npm pack --dry-run` to verify publish contents.
- Validate executable entrypoint is included and callable.

### 7.3 Post-Publish Smoke Verification

On clean environment after first release:

- `npm install -g luckybox@0.1.1`
- `luckybox --help`

Expected result:

- command resolves globally
- help output renders without runtime errors

## 8. Implementation Constraints and Invariants

- Do not alter deterministic key derivation standard behavior.
- Keep supported network set unchanged.
- Keep secure defaults in CLI behavior unchanged.
- Release automation must publish only from `main`.

## 9. Rollout Plan

1. Land package metadata and command contract changes.
2. Land CI and release workflow files.
3. Land changesets setup and initial `0.1.1` release entry.
4. Merge to `main` and verify release PR behavior.
5. Merge release PR to publish `0.1.1`.
6. Run post-publish smoke checks.

## 10. Acceptance Criteria

- Global install path works with unscoped package:
  - `npm install -g luckybox`
  - `luckybox --help`
- `vault` command is no longer exposed by package bin config.
- CI runs and passes on PRs and `main` pushes.
- Release workflow triggers only on `main`.
- Changesets generates release PR and publishes on release merge.
- First release is published as `0.1.1`.

## 11. Maintainer Runbook Requirements

Documentation must include:

- Required repository secret: `NPM_TOKEN`.
- Release PR lifecycle with Changesets.
- How to handle failed publish and retry safely.
- User-facing migration note from `vault` to `luckybox`.
