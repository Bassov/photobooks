## Implementation

- [x] 1. M17: drop the Add spread button + token; migrate unit / e2e callers to Add after / Ctrl+Enter
- [x] 2. M18: Cover / front Endpaper / back Endpaper inside the `spreads-list` scroller; inner Pages listbox; head offset in window, reveal and drag math
- [x] 3. M19: `thumbCardStyle` + `ThumbCard` for Cover and Endpaper rows
- [x] 4. M23: zoom-independent 44 px stack gap (stride, slot padding, camera placement, zoom-commit anchor, whole-stack zoom floor; half the spread below an 88 px spread); labels 6 px under the spread
- [x] 5. M24: single-page labels centred (page 1, single last page)
- [x] 6. `e2e/design-r2-spread-list.spec.ts`

## Manual test scenarios

1. 1440×900, open a book with endpapers on: no Add spread button; "…" → Add after adds a spread.
2. Scroll the spread list: Cover and Endpaper rows scroll away; back Endpaper sits after the last page.
3. Cover row card matches the kit shape (wide cover, label row).
4. Canvas: 44 px between spreads at Fit and after zoom in/out; page 1 and the last single page numbers centred.

Results (2026-10-31, 1440×900 Playwright on the built preview; `pnpm agent manual-qa` could not enter the editor: its `start-session` click is intercepted by the welcome header, and `WelcomeScreen.tsx` is unchanged on this branch):

- OK 1: no `add-spread`; row "…" → Add after 3 → 4 spreads (M17 e2e; `after-editor.png`).
- OK 2: Cover / front Endpaper y shift by exactly the list scroll delta; back Endpaper below the last page row (M18 e2e; `after-list-scrolled.png`).
- OK 3: cover card box `max(2.04, 1.6)`, paper full width at 2.04 within 1 px; matches kit `#/feature/spread-list-panel` (M19 e2e).
- OK 4: 44 ± 1 px at Fit, after zoom in and two steps out; label 6 px under; page 1, 2–3 and single last page 4 centred within 1 px (M23 / M24 e2e). Whole-book zoom still mounts all 40 fixture spreads.
