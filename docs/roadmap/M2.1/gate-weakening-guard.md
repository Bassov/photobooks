# gate-weakening-guard

Tag: prep
Milestone: M2.1
Title: test-level weakening fails pr-policy (PR #76 pattern)

## Scope

- [ ] A `pr-policy` rule set (same base-run, data-only model as `gate-ratchet`; static AST parse of head test files) that fails on added `test.skip` / `it.skip` / `describe.skip` / `test.fixme` / `test.fail` / `it.todo` / `.only`, and on added `test.describe.configure({ retries })` or per-test `retries`
- [ ] Test-title inventory per file (Vitest `src/**/*.test.*`, `scripts/**/*.test.mjs`, Playwright `e2e/**/*.spec.ts`): a test title present on base and missing on head fails unless the test file itself is deleted together with the code or spec scenario it covers. Renames pass when the body is unchanged (hash match)
- [ ] Explicit config: Vitest `allowOnly: false`; Playwright `forbidOnly: true` everywhere (not only on CI); both are ratcheted keys
- [ ] ESLint: `eslint-plugin-vitest` / `eslint-plugin-playwright` `no-focused-tests`, `no-skipped-tests`, `no-conditional-in-test` as errors (exact-pinned dev dependencies; until `docs/backlog/dependency-policy.md` is re-added they need `audit:ci` evidence and a Security Review pass)
- [ ] Fixture tests for every rule; rule ids join the ratchet superset rule
- [ ] Self-loosening of done criteria fails `pr-policy`: in an item PR, the item's own file (`docs/roadmap/<M>/<slug>.md`) may only tick `- [ ]` -> `- [x]`, set `Status: done` and add a Done note; any other change to its Scope / Done when / Size lines, or a new roadmap item added by the same PR whose text names this item's slug or defers its bar (coverage, mutation, NoCoverage, e2e), fails unless the PR body has an `Owner-approved scope change: <link>` line.
- **Done when:** fixture PRs that add a `.skip`, a `test.fixme`, a per-spec `retries: 3`, delete a Playwright test title, or set `forbidOnly: false` each fail `pr-policy`; a renamed test with an unchanged body passes; `pnpm lint` fails on a focused test; a fixture PR that rewrites its own item's Done-when (or adds a follow-up item deferring its mutation bar, as PR #92 r1 did) fails `pr-policy`, and a PR that only ticks its boxes and adds a Done note passes.
- **Size:** ~700 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #76, #72 K, #50 item 5; review findings PR #92 M1 (agent rewrote its own Done-when and added `roadmap-parallel-agents-mutation-coverage` instead of meeting the bar). Bar-dodging -> added after one occurrence (owner rule).
