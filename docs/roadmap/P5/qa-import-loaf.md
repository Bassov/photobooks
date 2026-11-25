# qa-import-loaf

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item qa-import-loaf

## Scope

- [ ] Fix QA-4 (`docs/qa/prod-qa-2026-11-25.md`): "Add folder…" with 14 photos (one 24 MP) logs long animation frames between thumbnails appearing and the dock settling. Profile first (LoAF script attribution), fix the path that owns the long frame for every import caller (folder add, file add, drop import), never raise `PERF_BUDGETS`.
- [ ] Done when: an e2e imports a folder with a 24 MP photo on first import and gates LoAF attributed to our code at the existing `src/perf/budgets.ts` budget; it passes on CI; PR body has before/after LoAF numbers.
- **Browser check:** Photos dock → Add folder… with the QA-4 folder; thumbnails fill in, no app-attributed LoAF.
