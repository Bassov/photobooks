# site-lightbox-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item site-lightbox-kit

## Scope

Kit part of the site lightbox (Designer design `site-lightbox`, READY 2026-11-05; Item 2: kit `Fullscreen` becomes the lightbox). Design source: orch `shared/design/site-lightbox/spec.md` §2 lightbox, §3 input, §5 kit changes, Designer decisions. Kit only, no prod files (prod is item 3).

- [ ] `uikit/src/features/site-viewer.tsx` `Fullscreen`: presentation look (bg `--presentation`, stage-dark shadow on the visible page(s), white/.1 chips, position line bottom 16 12/16 white/.6); fit area insets 64 top / 48 bottom / 64 sides (8 without `(hover: hover) and (pointer: fine)`); neighbours i ± 1 mounted at opacity 0, inert, 200 ms `translateX(±100%)` slide (none under reduced motion); Close X 32 at top 16 / right 16, Zoom chip 32 at right 56; arrows 40 at left / right 12, not rendered on `hover: none`, `visibility: hidden` at the ends; focus the dialog on open; Tab trapped (Previous, Next, Zoom, Close)
- [ ] Zoom 1–3× by transform only (`translate(x, y) scale(z)`, origin 0 0) on a layer around the active slide's fitted box: double-click / double-tap toggles 1 ↔ 2 about the point, Ctrl/⌘ + wheel and pinch about the cursor / midpoint, `+` `=` `-` `0` keys, Zoom chip; plain wheel and drag pan at z > 1 with the per-axis clamp; snap < 1.02 to 1; stepping resets zoom; Esc closes at any zoom; Home / End; swipe > 60 px steps at z 1
- [ ] Keep props `ratio`, `label`, `render` (site-photographer still works); add `initialZoom?`; test ids `lightbox` (+ `data-zoom` 2 dp), `site-fullscreen-book`, `site-fullscreen-close`, `site-fullscreen-indicator`, `site-fullscreen-zoom`; `SiteState.lbZoom?` → `initialZoom`
- [ ] `uikit/src/features/pages.tsx` `site-lightbox`: state "zoomed" (slide 3, `lbZoom: 2`); `edge` lines "Double-click or pinch zooms; drag pans", "Arrows hide on touch screens"
- [ ] `uikit/scripts/qa.mjs`: lightbox tab ring list Previous, Next, Zoom, Close; the fit check (pad 48, w 0.904) still passes; new checks: double-click → `data-zoom` "2.00"; Esc while zoomed closes; ArrowRight while zoomed → "1.00"; X does not overlap the active slide rect
- [ ] Re-baseline `#/demo` step `site-fullscreen` (capture as evidence; walk unchanged)
- **Done when:** at 1440×900 the kit lightbox matches spec §2 (Alps-ratio spread 1301.91 × 788 at x 69.04, y 64 ±0.5; X 32 px at 16/16; Zoom chip right 56; arrows 40 at 12, hidden on `hover: none` and at the ends); Ctrl+wheel / double-click change only `transform` (no width / height writes); neighbours mounted; 200 ms slide (none under reduced motion); kit qa green incl. the new checks.
- **Browser check:** kit `#/feature/site-lightbox` (states Fullscreen, Spread 2, Zoomed 2×) and `#/demo` publish → Open site → Fullscreen: step, double-click zoom, drag pan, Esc.
- **Hard nos:** no prod `src/` changes; no edits to uikit canvas / inspector / sections; no Fullscreen API; no click-to-step or click-outside-to-close; no blue / teal.
- **UI kit:** `uikit#/feature/site-lightbox`, `uikit#/demo` step `site-fullscreen`; parts `uikit/src/features/site-viewer.tsx` (`Fullscreen`)
