# library-leave-flake

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item library-leave-flake
Status: done

## Scope

- [x] `e2e/library-screens.spec.ts > change library updates folder name via FSA picker stub` failed 1/10 in CI burn-in (#534, run 42180328650): after `attachMemoryLibraryForTests()` → `createBookInLibrary()` → `leaveEditorForLibrary()` the `library-screen` never shows. Root-cause the race in `src/editor/projectSession.ts` / `src/editor/session/` and fix every editor → library caller (PR body lists each one as fixed or left out, with the reason)
- **Done when:** root cause named in the PR body; a Vitest test reproduces the race deterministically (fails on main, passes with the fix); the e2e above passes 30/30 locally (`--repeat-each=30 --retries=0 --workers=1`); spec not loosened (no longer timeouts, retries or extra waits)
- **Browser check:** n/a (no visual change; e2e `library-screen` visible after leave)
- **Test:** unit in `src/editor/projectSession.test.ts`; existing e2e repeated
- **Hard nos:** no edits to the e2e spec timing; no other items' `docs/roadmap.md` lines
