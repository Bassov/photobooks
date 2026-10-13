# Tasks

## 1. Coverage and Codecov

- [x] 1.1 Add Vitest `coverage.thresholds` (43/46/33/43) and `json-summary` reporter in `vite.config.ts`
- [x] 1.2 Add root `codecov.yml` (project floors, informational patch, unit flag, ignores, PR comment)
- [x] 1.3 Update `checks.yml`: `format:check`, coverage Step Summary from `coverage/coverage-summary.json`, Codecov token + conditional `fail_ci_if_error`

## 2. Mutation PR reporting

- [x] 2.1 Add `json` reporter to `stryker.config.json`
- [x] 2.2 Add `scripts/stryker-pr-summary.mjs` reading `reports/mutation/mutation.json`
- [x] 2.3 Update `stryker-diff.yml`: permissions; `if: always()` artifact + summary + sticky comment when report exists
- [x] 2.4 Update `stryker-full.yml` to write Step Summary via the same script

## 3. Dependency and secret gates

- [x] 3.1 Add `.github/dependabot.yml` (npm + github-actions, weekly)
- [x] 3.2 Add `dependency-review.yml` with `fail-on-severity: high`
- [x] 3.3 Add `gitleaks.yml` on PR and push to `main`

## 4. Lighthouse and docs

- [x] 4.1 Extend `lighthouse.yml` to run on push to `main`; add brief Step Summary if cheap
- [x] 4.2 Update `AGENTS.md` with `ci-gates` row and Codecov/secret-scanning note
- [x] 4.3 Add short README CI secrets note (`CODECOV_TOKEN`, GitHub secret scanning / push protection)

## 5. Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — no UI/bundle change)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive
