# cover-back-fill

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item cover-back-fill

## Scope

Bug (Designer note, `shared/design/cover-editor/spec.md` line 133): the Cover inspector Back section shows `Fill · Paper white · coming later`, while the canvas paints the back from `cover.style.backFill` (`#3e3c3b`, charcoal). Orchestrator decision (no Designer run: a value fix, not a new design).

- [ ] Prod `src/editor/CoverSection.tsx` Fill row is read-only: a swatch of `cover.style.backFill` (`fill-swatch`) and its hex in upper case (`fill-readonly`), kit Background row look (`size-3 rounded-2xs shadow-hairline`); no "coming later" in the row.
- [ ] Kit `uikit/src/sandbox/v7.tsx` Back Fill row matches (swatch + `#3E3C3B`); only that row changes.
- [ ] A default book shows `#3E3C3B`; a book with `backFill: '#112233'` shows `#112233` and that swatch colour (unit test); tests asserting the old Fill text are updated.
- [ ] A focused e2e checks the visible Fill row text on the `?fixture=` editor.
- Out of scope: Book settings page colour ("Paper white · coming later") and Endpaper Fill "coming later" are other rows.
- **Browser check:** open the cover in the `?fixture=` editor; the Back section Fill row reads a charcoal swatch + `#3E3C3B`, the same as the canvas back.
