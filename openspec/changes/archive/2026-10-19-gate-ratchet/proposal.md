# Proposal

## Why

**Problem:** Gate values and exclude lists have been weakened or moved out of required jobs (PR #93 burn-in move; PR #110 invalid `codecov.yml` silencing `codecov/patch`).

**Why now:** Reviews and lessons cannot stop that; CI must refuse any PR that makes gates weaker than base (issue #72 K / M2.1 ratchet).

## What Changes

- Add `scripts/check-gate-ratchet.mjs` and `.github/workflows/pr-policy.yml` on `pull_request_target`: workflow + script run from **base**; head fetched and parsed as data only (no head install/exec).
- Fail vs base on the weakenings listed in the roadmap item (values, excludes, includes, Stryker options, patches, ignore comments, any new `Stryker disable`, gate file rename/delete, required-job step moves without aggregating `needs:`).
- Self-protection: head rule-id list + fixture tests must be a **superset** of base; no label/override.
- `pnpm check` validates `codecov.yml` via Codecov API (`Valid!`); network-error-only pinned top-level key fallback.
- `ci-gates` delta for ratchet + `pr-policy`. Owner makes `pr-policy` a required check (setup note only).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ci-gates`: PR policy ratchet; required-job gate-step immutability; `codecov.yml` validity in `pnpm check`.

## Impact

**Scope in:** New workflow + ratchet + fixture tests; `pnpm check` codecov validation; `requiredCheckJobs` in `quality/gates.json`; `ci-gates` spec.

**Scope out:** Changing GitHub required-check settings; `stryker-disable-budget` allowlist; product UI.

**Success criteria:** Fixture weakenings fail `pr-policy`; editing workflow/script on a PR does not change how that PR is judged; burn-in move without `needs:` fails, with aggregating `needs:` passes; unknown codecov top-level key fails check, main file passes.

**Risks:** **Security** — `pull_request_target` must never execute head code; mis-parse could false-pass weakenings.
