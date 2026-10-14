# Tasks

## 1. Vite plugin

- [x] 1.1 Add `@codecov/vite-plugin` and configure it in `vite.config.ts` per design; verify `pnpm build` succeeds without `CODECOV_TOKEN`

## 2. CI + Codecov YAML

- [x] 2.1 Pass `CODECOV_TOKEN` into checks Build step and add informational `bundle_analysis` to `codecov.yml`; verify workflow YAML and codecov.yml retain existing coverage/components settings

## 3. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff (N/A — no mutable `src/` production modules changed)
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — config/CI + existing token reuse)

## Workflow follow-up

- Archive after implementation review; sync delta into `openspec/specs/ci-gates/`.
- Push to `feat/codecov-test-analytics-components` and update PR #15.
