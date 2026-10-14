# Tasks

## 1. Playwright helpers and call sites

- [x] 1.1 Add `e2e/fixtures/assertDocumentFitsViewport.ts` with `assertDocumentFitsViewport` and `assertNamedScrollport`
- [x] 1.2 Refactor `e2e/filmstrip.spec.ts` containment test to use helpers; add page-fit after bulk-perf gallery load
- [x] 1.3 Call `assertDocumentFitsViewport` from `e2e/smoke.spec.ts` after `goto('/')`

## 2. Agent pipeline mandates

- [x] 2.1 Update `openspec/config.yaml`: proposal scrollport success criteria; design helper note; apply guidance; quality-bar Playwright-not-ui-review line
- [x] 2.2 Update `.cursor/agents/openspec-proposal-reviewer.md` and `openspec-implementation-reviewer.md` scrollport checks
- [x] 2.3 Update `.cursor/skills/write-tests/SKILL.md` E2E bullet for shared viewport helpers

## 3. Durable docs

- [x] 3.1 Update `docs/roadmap.md` How to use + filmstrip + pasteboard Browser checks
- [x] 3.2 Append lessons.md line: `scrollLeft` alone does not prove page containment

## 4. Finish

- [x] 4.1 Sync delta `agent-context` into main specs on archive
- [x] 4.2 Append nothing further unless review finding repeats

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive
