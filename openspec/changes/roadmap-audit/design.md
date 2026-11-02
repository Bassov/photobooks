## Decisions

1. Close only with main-side evidence (merged PR, `src/`/`e2e/` file:line); everything else stays open. Partly shipped keeps get a one-line `**Audit 2026-11-02:**` note instead of a rescope.
2. `frame-styles` is superseded: create / edit / apply (`FrameStyleSection`, `editFrameStyle`) and spread background (`BackgroundSection`) ship on main; only visibility is left. New P2 item `framestyle-arrange-unhide` (top of P2, ahead of `arrange-lock` which builds on Arrange) owns turning the switch back on and the kit M78 look, and carries the frame-styles Browser check.
3. P1 is not archived here: after sync every P1 line is `[x]`, but its review cut is a Designer review, so `archive P1` is listed as needs Owner.
4. The counts line is header prose (not an item line), edited by hand to match the result.

## Touch-set & Test Plan

- Files: `docs/roadmap.md`, `docs/roadmap/P1/*.md` (closed / synced items, this item), `docs/roadmap/P2/*.md` (new item, `frame-styles`, `arrange-lock`, `user-templates`, `page-numbers`), `docs/roadmap/P4/{print-profiles,cover-editor}.md`, `openspec/changes/roadmap-audit/**`.
- Reuse: `pnpm roadmap done --note` / `add` / `sync`.
- Tests: N/A (docs only); `pnpm roadmap check` + hooks.
