# ui-create-dialog-chrome-v93

Tag: feature
Milestone: M3
Title: Create dialog chrome: centered+dim, Cancel+Create visible, field borders #D7D7D7
Status: done

## Scope

- [ ] Create book dialog centered on a dim backdrop; Cancel and Create fully visible at ≥1280×800; field borders `#D7D7D7`
- **Browser check:** open Create book at 1280×800 — panel centered, both buttons visible, quiet field borders, Create stays black.
- **UI ref:** `uikit#/demo`
- **UI kit:** `uikit/src/features/create-book.tsx` (`CreateBookDialog`), `uikit/src/features/library.tsx:283` — modal 460 px, `bg-black/40` backdrop
