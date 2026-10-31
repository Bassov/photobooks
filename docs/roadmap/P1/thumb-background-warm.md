# thumb-background-warm

Tag: feature
Milestone: P1
Title: Thumbs for the whole folder in the background

## Scope

- [ ] Background lane encodes thumb320 for every gallery asset without a hot or cached thumb, JPEG and HEIC/HEIF included (HEIC still fails as unsupported and keeps its placeholder; no retry loop). Order: distance from the current filmstrip window, scroll direction first; book-used before unused. The 1280 working preview stays on demand.
- [ ] Runs only in idle (`scheduleWhenNowEmpty`); 1 slot while the filmstrip scrolls or a canvas gesture is active, the idle cap otherwise; existing longtask / memory backoff applies. Each result is stored in DerivedCache by identity, so each file version is encoded once.
- [ ] Skip assets that already have a DerivedCache thumb (existence check, no read); needed after reload.
- [ ] Now set updates during scroll (throttled ~100 ms, window extended in the scroll direction by the current velocity) instead of only after the 200 ms scroll-quiet (`src/editor/filmstripVisibleSync.ts`).
- [ ] Spec delta: `filmstrip` "Visible-window decode priority" (drop "JPEG and HEIC/HEIF assets MUST NOT be queued for background full-original decode while outside now"), `image-tiers` identity-cache requirement (drop the JPEG/HEIC background ban; 1280 stays on demand), `asset-source` "JPEG head pass" (drop "Full-body decode for off-now JPEG MUST wait until visible ∪ book-used"). Now still outranks background; background never starves now.
- **Done when:** e2e: folder of ≥ 200 small JPEGs, no scrolling: every asset gets a thumb (test seam or DerivedCache count) within the test timeout; the existing tail-scroll priority e2e stays green (newly visible ids still preempt background work); HEIC placeholder behaviour unchanged.
- **Browser check:** new folder with 1000+ large JPEGs: wait about a minute without touching, then fling the strip end to end: no gray tiles; scrolling and canvas pan stay smooth while thumbs are being made.
- **Perf:** new `frame-budget gates` scenario: filmstrip scroll plus canvas pan while background thumb encode runs on ≥ 200 JPEGs: 0 LoAF.
- **UI kit:** `uikit#/feature/editor-shell-filmstrip` (`uikit/src/features/pages.tsx` page `editor-shell-filmstrip`); parts: `uikit/src/demo-parts/editor.tsx` (`PhotosDock, FilmstripPart`); no visual change
- **Test:** unit (ordering, idle-only, slot limit while scrolling) + e2e + perf scenario
- **Depends:** decode-slot-busy-until-reply, thumb-scaled-decode
