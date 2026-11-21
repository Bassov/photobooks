# interface-size-kit

Tag: feature
Milestone: P5
Title: Bug: /next-roadmap-item interface-size-kit

## Scope

- [ ] Item 3 of Designer tool 6 `interface-size` (Owner Q-28), part 1 of the kit work: kit Settings → Interface section with the UI scale choice (spec §1, D4 clamp, D8; Musts IS1 kit side, IS4 kit side, IS10). Kit overlays (portal rule for `uikit/src/components/ui` popover / menu / select / tooltip / dialog) are not here.
- [ ] `uikit/src/demo-parts/settings.tsx`: the stub Interface rows (Units / Thumbnail size / Density) go (D8); one "Interface size" row with the kit `Segmented` md (100% / 125% / 150%, width 224) and a hint (`Bigger text and controls for 4K screens.`, or `Window too small for {choice}%: showing {effective}%.` when clamped).
- [ ] `uikit/src/demo-parts/session.tsx`: session `uiScale: 100 | 125 | 150` (default 100) + setter. `uikit/src/demo-parts/root.tsx`: `demo-root` gets `zoom` = the effective scale under the D4 clamp (1280×720 minimum app) against the demo-root size.
- [ ] `uikit/src/features/pages.tsx` `site-settings`: scenarios `interface`, `interface-clamped`, `interface-focus`. `uikit/scripts/demo-capture.mjs`: new step `settings-interface` after `settings-from-library` and its baseline only.
- **Done when:** new `e2e/kit-interface-size.spec.ts`: kit Settings at 1440×900 shows the Interface section with §1 values (row 68.8, track 224×32, segments 28, hint 12 / 16.8, ±0.5) and no old stub rows; choosing 150 at 1440×900 shows the clamp hint and `demo-root` zoom stays 1; at 1920×1080 with 125 the zoom is 1.25; IS10: at 100 % existing kit e2e and demo baselines other than the new step pass untouched; `e2e/kit-library.spec.ts` Interface check stays green.
- **Browser check:** `/uikit/#/demo` at 1440×900 → Settings → Interface: one row, 100% selected; pick 150% → hint "Window too small for 150%: showing 100%.", nothing grows.
- **Hard nos:** `src/**`, `uikit/scripts/qa.mjs`, `uikit/src/sandbox/canvas.tsx`, `viewport.tsx`, `store.tsx`, `chrome.tsx`, kit crop specs, `uikit/src/components/ui/**`; no regeneration of existing demo baselines.
- **Test:** `e2e/kit-interface-size.spec.ts` (new).
- **Depends:** interface-size-core.
