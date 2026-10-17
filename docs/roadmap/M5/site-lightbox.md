# site-lightbox

Tag: feature
Milestone: M5
Title: fullscreen and swipe

## Scope

- [ ] Fullscreen lightbox with CSS zoom; swipe between spreads
- [ ] Reuses the spread pager from `presentation-mode`
- **Perf:** swipe and lightbox zoom `transform`-only, neighbours preloaded and decoded; mobile scenario with CPU throttling — zero LoAF.
- **Browser check:** fullscreen photos are sharp on 4K, light on mobile; swiping is smooth on a phone.
- **UI ref:** `uikit#/feature/site-lightbox`
