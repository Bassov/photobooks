# Proposal

## Why

**Problem:** Agents and PRs dodge quality bars by skipping/focusing tests, adding retries, deleting titles, or rewriting their own Done-when (PR #76, #92) — gate-value ratchet alone does not catch that.

**Why now:** M2.1 review cut requires `pr-policy` to refuse test-level weakening and self-loosened item criteria with the same base-run, data-only model as `gate-ratchet`.

## What Changes

- Extend `scripts/check-gate-ratchet.mjs` (+ `pr-policy` base-run path): static AST parse of head test files vs base; fail on added skip/fixme/fail/todo/only, added Playwright retries, missing test titles (unless file deleted with covered companion code), and item Scope/Done-when rewrites (or deferral items) without `Owner-approved scope change:`.
- Wire `PR_POLICY_BODY` from `github.event.pull_request.body` in `.github/workflows/pr-policy.yml` (`types` include `edited`).
- Ratcheted config: Vitest `allowOnly: false`; Playwright `forbidOnly: true` (everywhere).
- ESLint: exact-pinned `@vitest/eslint-plugin` + `eslint-plugin-playwright` — `no-focused-tests`, `no-skipped-tests`, `no-conditional-in-test` as errors; `pnpm audit:ci` + Security Review.
- New rule ids join `RULE_IDS` / `FIXTURE_IDS` supersets; fixture CLI proofs; real-repo inventory parse non-empty.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ci-gates`: test-level weakening + done-criteria self-loosening fail `pr-policy`; focused/skipped/conditional lint errors; allowOnly/forbidOnly ratchet.

## Impact

**Scope in:** ratchet detectors + fixtures; vitest/playwright config; ESLint plugins; `pr-policy.yml` body env; `ci-gates` delta.

**Scope out:** Product UI; GitHub required-check settings; numeric gate floors; other roadmap items.

**Success criteria:** Fixture trees adding `.skip` / `test.fixme` / per-spec `retries: 3` / deleted Playwright title / `forbidOnly: false` each fail `pr-policy`; rename with unchanged body passes; delete test file alone fails, with companion source deleted passes; `pnpm lint` fails on focused/skipped/conditional-in-test; Done-when rewrite or deferral item fails; box-tick + Done note alone passes; real-repo inventory non-empty.

**Risks:** **Security** — new ESLint deps (audit + Security Review); `pull_request_target` must keep base-only exec; parser false negatives on exotic test syntax.
