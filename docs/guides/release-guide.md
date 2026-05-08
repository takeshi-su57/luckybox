# Release Guide

This runbook covers how to publish `luckybox` to npm safely using changesets.

## Preconditions

1. Release changes are merged to `main` only.
2. CI is green for the target `main` commit.
3. `NPM_TOKEN` is configured as a repository secret for publish automation or available in your local release environment.

## Command Rename Note

- The CLI command is `luckybox`.
- The legacy `vault` command name has been removed.
- In this repository, use `pnpm run luckybox -- ...` for local command examples and validation.

## Main-Only Changesets Flow

1. Update from remote `main`:

```bash
git checkout main
git pull
```

2. Confirm pending changesets and version intent:

```bash
pnpm changeset status
```

3. Apply version bumps/changelog updates from changesets:

```bash
pnpm changeset version
```

4. Commit version artifacts:

```bash
git add .
git commit -m "chore: version packages"
```

5. Run release safety gates:

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm test
pnpm run build
pnpm pack --dry-run
```

6. Publish with changesets:

```bash
pnpm run release:publish
```

7. Push commit and tags:

```bash
git push --follow-tags
```

## Safety Gates

Do not publish if any of these fail:

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm test`
- `pnpm run build`
- `pnpm pack --dry-run`

These gates ensure deterministic derivation behavior, CLI integrity, and npm package viability before publish.

## Failed Publish Recovery

If publish fails, use this sequence:

1. Identify failure class:

- Auth/permission (`NPM_TOKEN`, 2FA policy, npm org access)
- Version conflict (`version already exists`)
- Registry/network transient
- Prepublish checks failure

2. Verify local release state:

```bash
git status
git tag --list
pnpm changeset status
```

3. Resolve by class:

- Auth/permission: refresh `NPM_TOKEN`, verify npm access, retry publish.
- Version exists: create a new changeset (or adjust versioning via normal changeset flow), rerun versioning, recommit.
- Network transient: retry `pnpm run release:publish` after confirming no partial local corruption.
- Gate failure: fix issue, rerun full safety gates, then retry publish.

4. Re-run safety gates before retrying publish.

5. If tags or version commits were created but publish failed, keep history explicit:

- Do not rewrite published history.
- Prefer a forward-fix commit + follow-up changeset over forceful history edits.
