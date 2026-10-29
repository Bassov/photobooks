# presentation-mode

Tag: feature
Milestone: M3
Title: preview the book
Status: done

## Scope

- [ ] Fullscreen, one spread at a time, arrow keys / click / swipe, Esc to exit, no editor chrome; same `SpreadView`
- [ ] Spread pager lives in `src/render/` so `site-lightbox` reuses it
- **Perf:** neighbouring spreads preloaded and decoded; transitions `transform` / `opacity` only. Gate: flip through 40 spreads quickly — zero LoAF, no blank frames.
- **Browser check:** present the book fullscreen and flip through it like a finished album.
- **UI ref:** `kit v0.9.3 #/feature/presentation-mode (removed in kit v0.10.0, no replacement)`
- **UI kit:** none in v0.10.0 (kit v0.9.3 `#/feature/presentation-mode (removed in kit v0.10.0)`, removed) — fullscreen present, no chrome
