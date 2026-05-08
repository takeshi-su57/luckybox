# Passphrase Safety Hardening (Option 3)

Date: 2026-05-08

## Goal

Make passphrase handling "safe by default" for interactive local use and minimize operational leakage and accidental secret exposure, while preserving deterministic derivation behavior defined by **Luckybox Deterministic Key Standard v1**.

This work explicitly targets:

- Preventing passphrase echoing to the screen in non-TTY contexts.
- Discouraging (or gating) secrets via command-line args and environment variables.
- Reducing accidental exposure of private keys in logs/objects.

Non-goals:

- Changing KDF parameters, derivation paths, or salt semantics.
- Claiming "memory-zeroing guarantees" in Node.js/JS (only best-effort is feasible).

## Current Observations / Risks

1. **Non-TTY passphrase echo risk**
   - Current behavior can fall back to visible input when hidden input is unavailable (non-TTY), which can echo the passphrase.

2. **Unsafe secret transport**
   - Accepting passphrases via `--passphrase` and `BRAIN_PASSPHRASE` is convenient for automation but commonly leaks via:
     - shell history / terminal scrollback
     - process listings
     - CI logs / env dumps

3. **Private key overexposure**
   - Returning a hex private key string from derivation helpers increases the chance it is logged or retained longer than needed.

## Requirements

### R1: Determinism and Compatibility

- The derived seed and addresses MUST remain reproducible given `passphrase + BRAIN_WALLET_SALT + standard definition`.
- No silent changes to:
  - KDF parameters (scrypt N/r/p, dkLen)
  - derivation paths (BIP44 components)
  - passphrase normalization rule (NFKD)
  - salt canonicalization semantics as currently defined

### R2: Safe-by-Default Interactive Use

- For normal interactive usage, the default mode MUST be a hidden prompt.
- If hidden input cannot be safely provided (e.g. non-TTY), the CLI MUST fail closed with an actionable error message.

### R3: Explicit Automation Paths

Add non-echoing automation paths that avoid process-arg exposure:

- `--passphrase-stdin`: read passphrase from stdin (intended for tests/automation).
- `--passphrase-file <path>`: read passphrase from a file (intended for tests/automation).
  - File contents are treated as bytes/utf8; trim exactly one trailing `\\n` (and optional `\\r\\n`) to accommodate typical files.

### R4: Gate "Unsafe" Inputs

Keep existing "unsafe" inputs for tests only, behind an explicit opt-in:

- `--passphrase <value>` and `BRAIN_PASSPHRASE` are only honored when `--allow-unsafe-passphrase` is present.
- When an unsafe path is used, print a one-line warning (stderr) unless `--quiet`.

### R5: Reduce Private Key Exposure

- Derivation helpers used by normal commands should not return `privateKey` by default.
- If the tool needs to show/export private keys, require an explicit command/flag with conspicuous warnings.

## Proposed UX / CLI Surface

### Defaults (interactive)

- `luckybox address box1`:
  - prompts for hidden passphrase
  - errors if hidden prompt cannot run safely

### Automation (safe)

- `echo mypass | luckybox address box1 --passphrase-stdin`
- `luckybox address box1 --passphrase-file ./passphrase.txt`

### Unsafe (test-only)

- `luckybox address box1 --passphrase "mypass" --allow-unsafe-passphrase`
- `BRAIN_PASSPHRASE=mypass luckybox address box1 --allow-unsafe-passphrase`
  - warns: "Using unsafe passphrase input (may leak via shell history/process/env)."

## Implementation Sketch (High Level)

1. **Prompt layer**
   - Update hidden prompt implementation to never fall back to visible input unless an explicit "unsafe" mode is requested.
   - Return clear errors for non-TTY contexts:
     - "Hidden prompt unavailable (stdin/stdout not TTY). Use `--passphrase-stdin` or `--passphrase-file`, or `--allow-unsafe-passphrase` for tests."

2. **Passphrase source selection**
   - Introduce a single resolver that chooses passphrase source with explicit precedence:
     1. `--passphrase-stdin` (safe automation)
     2. `--passphrase-file` (safe automation)
     3. Hidden prompt (interactive default)
     4. If `--allow-unsafe-passphrase`:
        - `--passphrase` or `BRAIN_PASSPHRASE`

3. **Wallet derivation API hardening**
   - Return `address`, `path`, `account` only by default.
   - Add an explicit path to export/show private key where needed (separate command or `--show-private-key` on a dedicated command).

4. **Best-effort secret cleanup**
   - Overwrite seed buffers after derivation when possible.
   - Do not claim guarantees; document as best-effort.

## Security Notes / Limitations

- JavaScript strings cannot be reliably zeroed; the goal is to minimize creation, scope, and accidental logging.
- `--passphrase-stdin` is safe from process listing exposure, but users must still avoid shell history leaks (e.g. `echo pass` can appear in history depending on shell settings). Recommend piping from a file or secure secret source for automation.

## Acceptance Criteria

- Non-TTY execution without `--passphrase-stdin`/`--passphrase-file`/unsafe opt-in fails closed (no passphrase echo).
- Default commands prompt hidden for passphrase and do not accept unsafe sources unless explicitly opted in.
- The deterministic derivation outputs (seed -> addresses) are unchanged for the same passphrase+salt+index.
- Private keys are not produced/returned by default code paths.
