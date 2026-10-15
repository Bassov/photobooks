# Tasks

## 1. Domain contract

- [x] 1.1 Add `src/project/types.ts` with `LibraryMeta`, `BookSummary`, typed result unions (incl. all failure codes), and `LibraryStorage`; verify `pnpm typecheck` accepts the types module
- [x] 1.2 Export the public surface from `src/project/index.ts`; verify imports resolve from `@`/relative consumers in a smoke typecheck

## 2. Memory adapter and contract suite

- [x] 2.1 Implement `createMemoryLibraryStorage` with insert-only create, update-only save, meta replace, `parseBook` load mapping, and adapter-local permission/lock/raw-seed hooks; verify happy-path create → save → load round-trip with `makeBook`
- [x] 2.2 Add shared `runLibraryStorageContract` suite covering every typed failure code and domain scenarios; wire memory factory so `pnpm test` runs it green
- [x] 2.3 Extend `.dependency-cruiser.cjs` so `src/core` cannot import `src/project`; verify `pnpm deps` passes

## 3. Docs

- [x] 3.1 Update `AGENTS.md` module map for `src/project/` → `library-storage`; tick nested `library-storage` checkboxes in `docs/roadmap.md` as work lands

## 4. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff — 100% (79 killed / 0 survived); no survivors to justify
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (no UI / no bundle entry)
- [x] UI in scope: browser smoke evidenced … — N/A (prep, no UI)
- [x] Docs/rules sync: AGENTS.md module map + roadmap nested ticks; no README/future-architecture drift beyond existing project storage notes
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: fa497aff)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (evidenced: a4ce45b3 pass; medium future-architecture already-exists note addressed)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI [prep]; contract suite covers spec scenarios (see Manual test scenarios)
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A (no FSA / workers / headers)

## Manual test scenarios

N/A — [prep] with no UI. Spec scenarios locked by `src/project/memory.test.ts` via `runLibraryStorageContract`:

1. Empty library lists no books; getLibrary returns `{}` — observed via contract suite.
2. createBook → listBooks includes id; saveBook → loadBook round-trip — observed via contract suite.
3. Typed failures: not-found, already-exists, corrupted, newer-schema, permission-required (all ops), locked-elsewhere (mutations only) — observed via contract suite.

## Workflow follow-up

- Archive the change after implementation review pass; sync delta specs into main `openspec/specs/`.
- Commit, push, open PR; tick top-level `library-storage` on the same branch after archive.
