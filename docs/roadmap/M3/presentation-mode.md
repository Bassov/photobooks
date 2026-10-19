# presentation-mode

Tag: feature
Milestone: M3
Title: preview the book

## Scope

- [ ] Fullscreen, one spread at a time, arrow keys / click / swipe, Esc to exit, no editor chrome; same `SpreadView`
- [ ] Spread pager lives in `src/render/` so `site-lightbox` reuses it
- **Perf:** neighbouring spreads preloaded and decoded; transitions `transform` / `opacity` only. Gate: flip through 40 spreads quickly — zero LoAF, no blank frames.
- **Browser check:** present the book fullscreen and flip through it like a finished album.
- **UI ref:** `uikit#/feature/presentation-mode`
- **UI kit:** `uikit/src/features/m3.tsx:334-343` (`presentation-mode` demo + notes), `UI ref: uikit#/feature/presentation-mode` — fullscreen present, no chrome
