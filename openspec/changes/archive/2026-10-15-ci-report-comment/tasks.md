# Tasks

## 1. CI report comment module

- [x] 1.1 Add `scripts/ci-report-comment.mjs` (`classifySection`, `upsertSection`, `renderComment`, `encodeState`, `decodeState`, `shouldWrite`) and `scripts/ci-report-comment.test.mjs` with inline inputs; extend Vitest `include` to `scripts/**/*.test.mjs` without changing `coverage.include`; verify `pnpm exec vitest run scripts/ci-report-comment.test.mjs` passes the status matrix, neighbor preservation, single details wrapper, `-->` round-trip, and superseded-head skip

## 2. Workflows

- [x] 2.1 In `checks.yml`, upload a coverage section artifact on `if: always()` and add a pull-request-only `ci-comment` job (`queue: max`, group `ci-report-${{ github.event.pull_request.number }}`, skip when the checks job was cancelled); remove the sticky coverage comment; verify the workflow no longer references `marocchino/sticky-pull-request-comment` and the comment job is absent from `push`
- [x] 2.2 In `lighthouse.yml`, upload a Lighthouse section artifact on `if: always()` and add the same `ci-comment` job; remove the sticky Lighthouse comment; verify success without an `lhr-*.json` is Job failed and a present report uses the LHCI step outcome
- [x] 2.3 In `stryker-diff.yml`, upload a mutation section artifact on `if: always()` (success and no `mutation.json` is Skipped) and add the same `ci-comment` job; keep the HTML artifact and Step Summary; remove the sticky mutation comment; verify `stryker-full.yml` does not call the comment script

## 3. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — no UI or bundle change)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass (N/A — no UI)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A — no map or convention change)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A — no package or lockfile change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — reuses existing pull-request token permissions)

## Workflow follow-up

- Archive the change after implementation review passes; sync the delta into `openspec/specs/ci-gates/`.
- Open the pull request with `Resolves #10`. Close pull request #25 as superseded.
