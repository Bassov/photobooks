# Tasks

## 1. Promote docs

- [x] 1.1 Re-read `.local_dev/future-architecture.md` from disk and copy it to `docs/future-architecture.md`; verify the file includes the 60 fps performance model and visual-regression issue `#8`
- [x] 1.2 Re-read `.local_dev/roadmap.md` from disk and copy it to `docs/roadmap.md`; verify M0 is checked done and the first M1 prep item is `` `frame-budget-gates` ``

## 2. Navigation and agent contract

- [x] 2.1 Update `AGENTS.md` Docs section to link `docs/future-architecture.md` (target architecture) and `docs/roadmap.md` (execution plan); verify both links present and AGENTS.md ≤150 lines
- [x] 2.2 Update `openspec/config.yaml` context Doc budget to mention `docs/roadmap.md`; verify the string appears in the context field
- [x] 2.3 Confirm delta at `openspec/changes/promote-architecture-roadmap/specs/agent-context/spec.md` matches apply (MODIFIED future-architecture + ADDED product roadmap); no edits needed unless drift found

## 3. Sanity

- [x] 3.1 Confirm no `.local_dev/` paths are staged for commit and no runtime/source under `src/` changed
- [x] 3.2 Run `pnpm verify:fast` and confirm green (docs-only; expect no production diffs)

## Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — N/A: docs-only, no UI/runtime change
- [x] pnpm stryker:diff — N/A: no production modules changed
- [x] pnpm test:lhci when UI or bundle size is affected — N/A: docs-only
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A: no deps, not security-tagged
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A: docs-only

## Workflow follow-up

- Archive the change after implementation review pass; sync delta into `openspec/specs/agent-context/`.
- Commit, push, and open PR for branch `docs/promote-architecture-roadmap`.
