# Tasks

## 1. Vitest JUnit output

- [x] 1.1 Configure Vitest `reporters` + `outputFile: reports/vitest-junit.xml` in `vite.config.ts` and verify `pnpm test:coverage` creates that file

## 2. CI Test Analytics upload

- [x] 2.1 Add `codecov/codecov-action@v7` with `report_type: test_results` immediately after “Unit and property tests” with `if: ${{ !cancelled() && hashFiles('reports/vitest-junit.xml') != '' }}`, `files: reports/vitest-junit.xml`, token + `fail_ci_if_error` mirroring coverage upload; verify workflow YAML parses and step order matches design

## 3. Codecov Components

- [x] 3.1 Add `component_management` for photo/perf/lib paths and include `components` in `comment.layout` in `codecov.yml`; verify YAML still contains existing project/patch/flag settings unchanged in intent

## 4. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — no UI/bundle change)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A — no map/convention change)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A — no package/lockfile change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — config/CI only, reuses existing token)

## Workflow follow-up

- Archive the change after implementation review passes; sync delta into `openspec/specs/ci-gates/`.
- Close or comment on GitHub issue #7 after merge.
