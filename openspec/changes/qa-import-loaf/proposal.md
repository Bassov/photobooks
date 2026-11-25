## Proposal

Roadmap: `docs/roadmap/P5/qa-import-loaf.md` (scope / Done when / Perf SoT); report `docs/qa/prod-qa-2026-11-25.md` QA-4.

### Scope out

- `PERF_BUDGETS` values (unchanged); decode / thumb workers (profile shows no decode on the main thread).
- `EditorShell.tsx`, `projectSession.ts`, `uikit/` (other lanes).

### Delta / Risk

- The layout inspector reads a book snapshot that ignores `gallery` / `assets` publishes; a reader of those fields through it would go stale (none today; doc comment + unit test).
