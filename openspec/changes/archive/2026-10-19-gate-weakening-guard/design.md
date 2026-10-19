# Design

## Context

`gate-ratchet` already judges PRs via `pr-policy` (`pull_request_target`, base install, head as data). Playwright still uses `forbidOnly: isCi`; Vitest has no `allowOnly: false`. No ESLint focus/skip rules. Agents dodge bars via skip/retries/deleted titles/Done-when rewrites (PR #76, #92).

## Goals / Non-Goals

**Goals:** Test-level weakening + item criteria self-loosening fail `pr-policy`; allowOnly/forbidOnly ratcheted; ESLint focus/skip/conditional-in-test errors; fixture + real-repo proofs; mutation ≥85% / 0 NoCoverage on new helpers.

**Non-Goals:** Product UI; GitHub required-check settings; numeric floors; `stryker-disable-budget`.

## Decisions

1. **Extend `compareGateTrees`** — New rule ids in `RULE_IDS`/`FIXTURE_IDS` (superset). Helpers: inventory, skip/focus/retries, config extractors, item-file diff. No separate workflow.

2. **TypeScript AST** — `typescript.createSourceFile` on file text only. Globs: `src/**/*.test.*`, `scripts/**/*.test.mjs`, `e2e/**/*.spec.ts`. Detect `test|it|describe` + `.skip|.only|.todo|.fixme|.fail`; `test.describe.configure({ retries })` / per-test `{ retries }`.

3. **Title inventory + co-deletion** — Per file: title → body hash. Missing title on an existing head file fails (rename+same hash passes). Whole test file absent on head fails unless a companion source is also absent: strip `.test`/`.spec` → same-dir `.{ts,tsx,mjs}`; for `e2e/*.spec.ts` without that sibling, also accept a deleted `src/**/<basename>.*`. Fixture: title-only delete fails; file-alone fails; file+companion passes.

4. **Config ratchet** — Head keeps Vitest `allowOnly: false` and Playwright `forbidOnly: true` (literal `true`, not `isCi`).

5. **Item criteria + PR body** — For `docs/roadmap/<M>/<slug>.md` on `feat|fix/<slug>`: allow only `- [ ]`→`- [x]`, `Status: done`, Done note — else fail unless PR body has `Owner-approved scope change: <link>`. Same for new roadmap items naming the slug or deferring coverage/mutation/NoCoverage/e2e. CI: `.github/workflows/pr-policy.yml` sets `PR_POLICY_BODY: ${{ github.event.pull_request.body }}`, adds `types: [..., edited]`, passes `--pr-body-env PR_POLICY_BODY` (or equivalent) into `gate-ratchet-cli.mjs`. Local/fixtures: explicit `--pr-body` / empty.

6. **ESLint** — Exact-pin `@vitest/eslint-plugin` + `eslint-plugin-playwright`; errors: vitest `no-focused-tests` / `no-disabled-tests` / `no-conditional-in-test`; playwright `no-focused-test` / `no-skipped-test` / `no-conditional-in-test`. `pnpm audit:ci` + Security Review.

7. **Proofs** — Real CLI on fixture dirs; unit test runs detectors on real repo files (non-empty).

## Security

- Base-only exec unchanged; head text parse only.
- New ESLint deps: audit + Security Review.
- No skip override for new rules.

## Touch-set

| Path                                          | Reason                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| `.github/workflows/pr-policy.yml`             | `PR_POLICY_BODY` + `edited` trigger                  |
| `scripts/check-gate-ratchet.mjs`              | RULE/FIXTURE ids + compare wiring                    |
| `scripts/check-test-weakening.mjs`            | AST inventory / skip / item-criteria helpers         |
| `scripts/check-test-weakening.test.mjs`       | helper unit tests + real-repo inventory              |
| `scripts/check-gate-ratchet.test.mjs`         | fixture Done-when CLI proofs                         |
| `stryker.config.mjs`                          | mutate include for `check-test-weakening.mjs`        |
| `e2e/**/*.spec.ts`, `e2e/perf/perfFixture.ts` | ESLint conditional cleanup; browser evaluate helpers |
| `src/**/*.{test,spec}.{ts,tsx}`               | ESLint conditional cleanup (`assert` / helpers)      |
| `scripts/e2e-burn-in-targets.test.mjs`        | ESLint conditional cleanup                           |
| `scripts/roadmap.test.mjs`                    | ESLint conditional cleanup                           |
| `scripts/gate-ratchet-cli.mjs`                | `--pr-body` / env handoff if needed                  |
| `vite.config.ts`                              | `allowOnly: false`                                   |
| `playwright.config.ts`                        | `forbidOnly: true`                                   |
| `eslint.config.js`                            | vitest/playwright rules                              |
| `package.json`                                | exact-pin ESLint plugins                             |
| `pnpm-lock.yaml`                              | lockfile for pinned plugins                          |
| `openspec/specs/ci-gates/spec.md`             | archive sync                                         |
| `openspec/changes/gate-weakening-guard/**`    | planning + delta                                     |
| `docs/roadmap/M2.1/gate-weakening-guard.md`   | tick / Done note only                                |

## Risks / Trade-offs

- [Dynamic titles missed] → static string/template only; fixtures cover common forms.
- [Companion heuristic gaps] → table-driven paths; e2e basename fallback documented.
- [ESLint plugin churn] → exact pins; audit + Security Review.

## Open Questions

N/A
