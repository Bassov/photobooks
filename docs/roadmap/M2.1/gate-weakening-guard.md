# gate-weakening-guard

Tag: prep
Milestone: M2.1
Title: test-level weakening fails pr-policy (PR #76 pattern)

## Scope

- [ ] A `pr-policy` rule set (same base-run, data-only model as `gate-ratchet`; static AST parse of head test files) that fails on added `test.skip` / `it.skip` / `describe.skip` / `test.fixme` / `test.fail` / `it.todo` / `.only`, and on added `test.describe.configure({ retries })` or per-test `retries`
- [ ] Test-title inventory per file (Vitest `src/**/*.test.*`, `scripts/**/*.test.mjs`, Playwright `e2e/**/*.spec.ts`): a test title present on base and missing on head fails unless the test file itself is deleted together with the code or spec scenario it covers. Renames pass when the body is unchanged (hash match)
- [ ] Explicit config: Vitest `allowOnly: false`; Playwright `forbidOnly: true` everywhere (not only on CI); both are ratcheted keys
- [ ] ESLint: `eslint-plugin-vitest` / `eslint-plugin-playwright` `no-focused-tests`, `no-skipped-tests`, `no-conditional-in-test` as errors (exact-pinned dev dependencies; until `dependency-policy` they need `audit:ci` evidence and a Security Review pass)
- [ ] Fixture tests for every rule; rule ids join the ratchet superset rule
- **Done when:** fixture PRs that add a `.skip`, a `test.fixme`, a per-spec `retries: 3`, delete a Playwright test title, or set `forbidOnly: false` each fail `pr-policy`; a renamed test with an unchanged body passes; `pnpm lint` fails on a focused test.
- **Size:** ~700 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #76, #72 K, #50 item 5
